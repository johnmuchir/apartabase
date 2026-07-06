import React, { useState, useEffect, useRef } from "react";
import { FileText, FileCheck, LogOut, Calendar, Plus, Loader2, FileDown, AlertCircle, Coins, Wrench, ShieldAlert } from "lucide-react";
import { entities, integrations } from "@/api/supabaseClient";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

export default function UnitLeaseCard({ unit, leases, onLeaseUpdated, propertyName }) {
  const { profile, demoRole } = useAuth();
  const { toast } = useToast();
  
  const activeLease = leases.find((l) => l.unit_id === unit.id && l.status === "Active");
  const isAgent = demoRole === "agent" || profile?.role === "agent";

  // Check-in state
  const [showCheckin, setShowCheckin] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [rent, setRent] = useState(unit.monthly_rent || "");
  const [deposit, setDeposit] = useState(unit.monthly_rent || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [leaseFile, setLeaseFile] = useState(null);
  const [beforeFile, setBeforeFile] = useState(null);
  const [savingCheckin, setSavingCheckin] = useState(false);

  // Check-out state
  const [showCheckout, setShowCheckout] = useState(false);
  const [afterFile, setAfterFile] = useState(null);
  const [savingCheckout, setSavingCheckout] = useState(false);
  const [heldDeposits, setHeldDeposits] = useState([]);
  // Deposit reconciliation state
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [arrearsAllocations, setArrearsAllocations] = useState({});
  const [damagesAmount, setDamagesAmount] = useState("");
  const [damagesDescription, setDamagesDescription] = useState("");

  // Notices and Evictions state
  const [vacateNotice, setVacateNotice] = useState(null);
  const [activeEviction, setActiveEviction] = useState(null);
  const [showEvictionForm, setShowEvictionForm] = useState(false);
  const [evictionForm, setEvictionForm] = useState({ breachType: "Rent Arrears", noticePeriod: 14, terminationDate: "", letterFile: null });
  const [submittingEviction, setSubmittingEviction] = useState(false);

  useEffect(() => {
    if (showCheckin) {
      loadTenantProfiles();
    }
  }, [showCheckin]);

  useEffect(() => {
    if (showCheckout && activeLease?.tenant_id) {
      loadHeldDeposits();
      loadUnpaidInvoices();
    } else if (!showCheckout) {
      // Reset reconciliation state when dialog closes
      setArrearsAllocations({});
      setDamagesAmount("");
      setDamagesDescription("");
    }
  }, [showCheckout, activeLease]);

  useEffect(() => {
    if (activeLease?.tenant_id) {
      loadTenantNotices();
    } else {
      setVacateNotice(null);
      setActiveEviction(null);
    }
  }, [activeLease, showCheckout, showEvictionForm]);

  const loadTenantNotices = async () => {
    try {
      const { data: notices } = await supabase
        .from("vacate_notices")
        .select("*")
        .eq("tenant_id", activeLease.tenant_id)
        .in("status", ["Pending", "Approved"])
        .order("created_date", { ascending: false });
      if (notices && notices.length > 0) {
        setVacateNotice(notices[0]);
      } else {
        setVacateNotice(null);
      }

      const { data: evs } = await supabase
        .from("evictions")
        .select("*")
        .eq("tenant_id", activeLease.tenant_id)
        .eq("status", "Issued")
        .order("created_date", { ascending: false });
      if (evs && evs.length > 0) {
        setActiveEviction(evs[0]);
      } else {
        setActiveEviction(null);
      }
    } catch (e) {
      console.error("Error loading notices:", e);
    }
  };

  const handleApproveNotice = async () => {
    if (!vacateNotice) return;
    try {
      const { error } = await supabase
        .from("vacate_notices")
        .update({ status: "Approved" })
        .eq("id", vacateNotice.id);
      if (error) throw error;
      toast({ title: "Notice approved." });
      loadTenantNotices();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to approve notice", variant: "destructive" });
    }
  };

  const handleRescindEviction = async () => {
    if (!activeEviction) return;
    try {
      const { error } = await supabase
        .from("evictions")
        .update({ status: "Rescinded" })
        .eq("id", activeEviction.id);
      if (error) throw error;
      toast({ title: "Eviction notice rescinded." });
      loadTenantNotices();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to rescind eviction", variant: "destructive" });
    }
  };

  const handleEvictionSubmit = async (e) => {
    e.preventDefault();
    if (!evictionForm.terminationDate) return;
    setSubmittingEviction(true);
    try {
      let uploadedLetterUrl = null;
      if (evictionForm.letterFile) {
        const res = await integrations.Core.UploadFile({ file: evictionForm.letterFile });
        uploadedLetterUrl = res?.url || null;
      }
      const { error } = await supabase
        .from("evictions")
        .insert({
          tenant_id: activeLease.tenant_id,
          lease_id: activeLease.id,
          breach_type: evictionForm.breachType,
          notice_period_days: parseInt(evictionForm.noticePeriod),
          termination_date: evictionForm.terminationDate,
          eviction_letter_url: uploadedLetterUrl,
          status: "Issued",
        });
      if (error) throw error;
      toast({ title: "Eviction notice issued successfully!" });
      setShowEvictionForm(false);
      setEvictionForm({ breachType: "Rent Arrears", noticePeriod: 14, terminationDate: "", letterFile: null });
      loadTenantNotices();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to issue eviction", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingEviction(false);
    }
  };

  useEffect(() => {
    if (showCheckout && activeLease?.tenant_id) {
      loadHeldDeposits();
    }
  }, [showCheckout, activeLease]);

  const loadHeldDeposits = async () => {
    try {
      const { data, error } = await supabase
        .from("tenant_deposits")
        .select("*")
        .eq("tenant_id", activeLease.tenant_id)
        .eq("status", "Held");
      if (!error) {
        setHeldDeposits(data || []);
      }
    } catch (e) {
      console.error("Error loading held deposits:", e);
    }
  };

  const loadUnpaidInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, month_for, total, amount_paid, status, unit_id, unit_number, property_id, property_name, invoice_number")
        .eq("tenant_id", activeLease.tenant_id)
        .neq("status", "Paid")
        .order("due_date", { ascending: true });
      if (!error) {
        const invoices = data || [];
        setUnpaidInvoices(invoices);
        const initial = {};
        invoices.forEach((inv) => { initial[inv.id] = ""; });
        setArrearsAllocations(initial);
      }
    } catch (e) {
      console.error("Error loading unpaid invoices:", e);
    }
  };

  const loadTenantProfiles = async () => {
    try {
      // Query profiles with tenant role who don't already have an active unit
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("role", "tenant");
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (e) {
      console.error("Error loading tenant profiles:", e);
    }
  };

  const handleCheckinSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProfileId || !rent || !deposit || !startDate) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
    if (!selectedProfile) return;

    setSavingCheckin(true);
    try {
      // 1. Upload files to Supabase Storage
      const uploads = [];
      let uploadedLeaseUrl = null;
      let uploadedBeforeUrl = null;

      if (leaseFile) {
        uploads.push(
          integrations.Core.UploadFile({ file: leaseFile }).then(res => {
            uploadedLeaseUrl = res?.url || null;
          })
        );
      }
      if (beforeFile) {
        uploads.push(
          integrations.Core.UploadFile({ file: beforeFile }).then(res => {
            uploadedBeforeUrl = res?.url || null;
          })
        );
      }

      await Promise.all(uploads);

      // 2. Create the tenant record
      const { data: newTenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          full_name: selectedProfile.full_name,
          phone: selectedProfile.phone || "",
          email: selectedProfile.email,
          property_id: unit.property_id,
          unit_id: unit.id,
          unit_number: unit.unit_number,
          property_name: propertyName || "",
          status: "Active",
          monthly_rent: parseInt(rent),
          lease_start: startDate,
          lease_end: endDate || null,
          user_id: selectedProfile.id,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 3. Create the lease record
      const { error: leaseError } = await supabase
        .from("leases")
        .insert({
          unit_id: unit.id,
          property_id: unit.property_id,
          tenant_id: newTenant.id,
          start_date: startDate,
          end_date: endDate || null,
          monthly_rent: parseInt(rent),
          deposit: parseInt(deposit),
          lease_agreement_url: uploadedLeaseUrl,
          inspection_before_url: uploadedBeforeUrl,
          status: "Active",
        });

      if (leaseError) throw leaseError;

      // 4. Update the unit properties
      const { error: unitError } = await supabase
        .from("units")
        .update({
          status: "Occupied",
          tenant_id: newTenant.id,
          tenant_name: newTenant.full_name,
          monthly_rent: parseInt(rent),
        })
        .eq("id", unit.id);

      if (unitError) throw unitError;

      toast({ title: "Tenant checked in and lease activated!" });
      setShowCheckin(false);
      resetCheckinForm();
      onLeaseUpdated?.();
    } catch (err) {
      toast({
        title: "Check-in failed",
        description: err.message || "Failed to save lease parameters",
        variant: "destructive",
      });
    } finally {
      setSavingCheckin(false);
    }
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!activeLease) return;

    const totalHeld = heldDeposits.reduce((sum, d) => sum + d.amount_paid, 0);
    const totalArrearsAllocated = Object.values(arrearsAllocations).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
    const totalDamages = parseInt(damagesAmount) || 0;

    if (totalArrearsAllocated + totalDamages > totalHeld) {
      toast({ title: "Validation Error", description: "Deductions cannot exceed total held deposits.", variant: "destructive" });
      return;
    }

    setSavingCheckout(true);
    try {
      const checkoutDate = new Date().toISOString().split("T")[0];

      // Fetch tenant details for reference in payment/invoice records
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("full_name, unit_number, property_id, property_name")
        .eq("id", activeLease.tenant_id)
        .single();
      const tenantName = tenantData?.full_name || "";
      const unitNumber = tenantData?.unit_number || unit.unit_number || "";
      const propertyId = tenantData?.property_id || unit.property_id;
      const propertyName = tenantData?.property_name || propertyName || "";

      let uploadedAfterUrl = null;
      if (afterFile) {
        const res = await integrations.Core.UploadFile({ file: afterFile });
        uploadedAfterUrl = res?.url || null;
      }

      // 1. Terminate the Lease
      const { error: leaseError } = await supabase
        .from("leases")
        .update({
          status: "Terminated",
          inspection_after_url: uploadedAfterUrl,
          end_date: checkoutDate,
        })
        .eq("id", activeLease.id);
      if (leaseError) throw leaseError;

      // 2. Inactivate the Tenant profile
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({ status: "Inactive", lease_end: checkoutDate })
        .eq("id", activeLease.tenant_id);
      if (tenantError) throw tenantError;

      // 3. Reset the Unit back to Vacant
      const { error: unitError } = await supabase
        .from("units")
        .update({ status: "Vacant", tenant_id: null, tenant_name: null, monthly_rent: 0 })
        .eq("id", unit.id);
      if (unitError) throw unitError;

      // 4. Process arrears payments (deposit offset)
      for (const [invoiceId, allocStr] of Object.entries(arrearsAllocations)) {
        const alloc = parseInt(allocStr) || 0;
        if (alloc <= 0) continue;
        const inv = unpaidInvoices.find((i) => i.id === invoiceId);
        if (!inv) continue;

        // Record deposit-offset payment against the invoice
        const { error: payErr } = await supabase.from("payments").insert({
          tenant_id: activeLease.tenant_id,
          tenant_name: tenantName,
          unit_id: inv.unit_id || unit.id,
          unit_number: inv.unit_number || unitNumber,
          property_id: inv.property_id || propertyId,
          property_name: inv.property_name || propertyName,
          amount: alloc,
          payment_date: checkoutDate,
          payment_method: "Deposit Offset",
          month_for: inv.month_for,
          reference: `DEP-ARR-${Date.now().toString().slice(-6)}`,
          invoice_number: inv.invoice_number,
          status: "Verified",
          deposit_portion: alloc,
          notes: "Settled from security deposit during move-out (arrears)",
        });
        if (payErr) throw payErr;

        // Update invoice amount_paid
        const newAmountPaid = Math.min(inv.total, (inv.amount_paid || 0) + alloc);
        const newStatus = newAmountPaid >= inv.total ? "Paid" : "Partially Paid";
        await supabase.from("invoices").update({ amount_paid: newAmountPaid, status: newStatus }).eq("id", invoiceId);
      }

      // 5. Process damages deduction
      if (totalDamages > 0) {
        const dmgInvoiceNumber = `DMG-${Date.now().toString().slice(-6)}`;
        const { error: dmgInvErr } = await supabase.from("invoices").insert({
          lease_id: activeLease.id,
          unit_id: unit.id,
          unit_number: unitNumber,
          property_id: propertyId,
          property_name: propertyName,
          tenant_id: activeLease.tenant_id,
          tenant_name: tenantName,
          month_for: "Move-out Damages",
          due_date: checkoutDate,
          base_rent: 0,
          items: [{ description: damagesDescription || "Damages found during checkout", amount: totalDamages }],
          total: totalDamages,
          amount_paid: totalDamages,
          status: "Paid",
          invoice_number: dmgInvoiceNumber,
        });
        if (dmgInvErr) throw dmgInvErr;

        const { error: dmgPayErr } = await supabase.from("payments").insert({
          tenant_id: activeLease.tenant_id,
          tenant_name: tenantName,
          unit_id: unit.id,
          unit_number: unitNumber,
          property_id: propertyId,
          property_name: propertyName,
          amount: totalDamages,
          payment_date: checkoutDate,
          payment_method: "Deposit Offset",
          month_for: "Move-out Damages",
          reference: `DMG-PAY-${Date.now().toString().slice(-6)}`,
          invoice_number: dmgInvoiceNumber,
          status: "Verified",
          deposit_portion: totalDamages,
          notes: `Settled from deposit for damages: ${damagesDescription || "Checkout repairs"}`,
        });
        if (dmgPayErr) throw dmgPayErr;
      }

      // 6. Update deposit records — split Applied vs Refunded
      const totalApplied = totalArrearsAllocated + totalDamages;
      let remainingToApply = totalApplied;
      let refundedDepositsSum = 0;

      for (const dep of heldDeposits) {
        if (remainingToApply <= 0) {
          // Set to Pending for manual payout collection by agent later
          await supabase.from("tenant_deposits").update({ status: "Pending" }).eq("id", dep.id);
          refundedDepositsSum += dep.amount_paid;
        } else if (dep.amount_paid <= remainingToApply) {
          // Fully applied to deductions
          await supabase.from("tenant_deposits").update({ status: "Applied" }).eq("id", dep.id);
          remainingToApply -= dep.amount_paid;
        } else {
          // Partially applied — split into two records
          const appliedPart = remainingToApply;
          const refundedPart = dep.amount_paid - remainingToApply;
          await supabase.from("tenant_deposits").update({ amount_paid: refundedPart, status: "Pending" }).eq("id", dep.id);
          refundedDepositsSum += refundedPart;
          await supabase.from("tenant_deposits").insert({
            tenant_id: dep.tenant_id,
            invoice_id: dep.invoice_id,
            deposit_type: `${dep.deposit_type} (Applied)`,
            amount_billed: appliedPart,
            amount_paid: appliedPart,
            status: "Applied",
          });
          remainingToApply = 0;
        }
      }

      // 7. Mark notices
      if (vacateNotice) {
        await supabase.from("vacate_notices").update({ status: "Completed" }).eq("id", vacateNotice.id);
      }
      if (activeEviction) {
        await supabase.from("evictions").update({ status: "Enforced" }).eq("id", activeEviction.id);
      }

      toast({ title: "Tenant checked out successfully!" });
      setShowCheckout(false);
      setAfterFile(null);
      onLeaseUpdated?.();
    } catch (err) {
      toast({
        title: "Check-out failed",
        description: err.message || "Failed to process checkout",
        variant: "destructive",
      });
    } finally {
      setSavingCheckout(false);
    }
  };

  const resetCheckinForm = () => {
    setSelectedProfileId("");
    setRent(unit.monthly_rent || "");
    setDeposit(unit.monthly_rent || "");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setLeaseFile(null);
    setBeforeFile(null);
  };

  // 1. Vacant State (No Active Lease)
  if (!activeLease) {
    return (
      <div className="mt-3 pt-3 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lease Settings</h4>
          </div>
          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Vacant</span>
        </div>
        <p className="text-xs text-muted-foreground">No active lease associated with this unit.</p>
        
        {isAgent && (
          <Button size="sm" className="w-full text-xs h-9 mt-2" onClick={() => setShowCheckin(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Check-in Tenant
          </Button>
        )}

        {/* Check-in Dialog */}
        <Dialog open={showCheckin} onOpenChange={setShowCheckin}>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Check-in Tenant</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCheckinSubmit} className="space-y-4 pt-2">
              <div>
                <Label>Select Tenant Profile *</Label>
                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.length === 0 ? (
                      <SelectItem value="none" disabled>No registered tenants found</SelectItem>
                    ) : (
                      profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} ({p.phone || "No phone"})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Rent (KES/mo) *</Label>
                  <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} required />
                </div>
                <div>
                  <Label>Deposit (KES) *</Label>
                  <Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Lease Agreement Document</Label>
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setLeaseFile(e.target.files?.[0])} />
              </div>

              <div>
                <Label>Inspection Report (Before Check-in)</Label>
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setBeforeFile(e.target.files?.[0])} />
              </div>

              <Button type="submit" className="w-full h-11" disabled={savingCheckin}>
                {savingCheckin ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating Lease
                  </>
                ) : (
                  "Check-in & Activate Lease"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // 2. Occupied State (Active Lease)
  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {/* Vacate notice alert banner */}
      {vacateNotice && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900">Vacate Notice: {vacateNotice.status}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Move-out date: {vacateNotice.expected_vacate_date}</p>
            {vacateNotice.reason && <p className="text-[10px] text-amber-600 mt-1 italic">"{vacateNotice.reason}"</p>}
            {isAgent && vacateNotice.status === "Pending" && (
              <Button onClick={handleApproveNotice} size="sm" className="h-6 text-[10px] mt-2 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md">
                Approve Notice
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Eviction notice alert banner */}
      {activeEviction && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-900">Active Eviction Issued</p>
            <p className="text-[11px] text-red-700 mt-0.5">Deadline: {activeEviction.termination_date} ({activeEviction.breach_type})</p>
            {isAgent && (
              <Button onClick={handleRescindEviction} size="sm" variant="outline" className="h-6 text-[10px] mt-2 text-red-500 border-red-200 hover:bg-red-50 font-semibold rounded-md">
                Rescind Eviction Notice
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Lease</h4>
        </div>
        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Occupied</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Monthly Rent</p>
          <p className="font-semibold">{formatKES(activeLease.monthly_rent)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Deposit Paid</p>
          <p className="font-semibold">{formatKES(activeLease.deposit)}</p>
        </div>
      </div>

      {/* Side-by-side Inspection Logic */}
      <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2.5">
        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Double Inspection Reports</h5>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="space-y-1">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">1. Before Check-in</p>
            {activeLease.inspection_before_url ? (
              <a
                href={activeLease.inspection_before_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
              >
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> View Before File
              </a>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">No file uploaded</p>
            )}
          </div>

          <div className="space-y-1 border-l border-border pl-3">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">2. After Check-out</p>
            {activeLease.inspection_after_url ? (
              <a
                href={activeLease.inspection_after_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
              >
                <FileCheck className="w-3.5 h-3.5 text-red-500" /> View After File
              </a>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Not checked out yet</p>
            )}
          </div>
        </div>
      </div>

      {activeLease.lease_agreement_url && (
        <a
          href={activeLease.lease_agreement_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs text-primary hover:underline font-medium"
        >
          <FileCheck className="w-4 h-4 text-emerald-600" /> Download Signed Lease Agreement
        </a>
      )}

      {isAgent && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-500 border-red-200 hover:bg-red-50 text-xs h-9 mt-1"
            onClick={() => setShowCheckout(true)}
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Check-out
          </Button>
          {!activeEviction && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-amber-600 border-amber-200 hover:bg-amber-50 text-xs h-9 mt-1"
              onClick={() => setShowEvictionForm(true)}
            >
              <AlertCircle className="w-3.5 h-3.5 mr-1" /> Evict Tenant
            </Button>
          )}
        </div>
      )}

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-sm mx-auto max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeEviction ? "Enforce Eviction & Check-out" : "Confirm Tenant Check-out"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-2">
            <div className={`border rounded-xl p-3.5 flex gap-2.5 ${activeEviction ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
              <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${activeEviction ? "text-red-600" : "text-amber-600"}`} />
              <div>
                <p className={`text-xs font-semibold ${activeEviction ? "text-red-900" : "text-amber-900"}`}>
                  {activeEviction ? "Eviction Enforcement" : "Check-out Warning"}
                </p>
                <p className={`text-[11px] ${activeEviction ? "text-red-700" : "text-amber-700"}`}>
                  {activeEviction
                    ? `Enforcing eviction for: ${activeEviction.breach_type}. This terminates the lease, marks the tenant Inactive, and settles the deposit.`
                    : "This terminates the active lease, marks the tenant as Inactive, and returns the unit to Vacant."}
                </p>
              </div>
            </div>

            {heldDeposits.length > 0 && (() => {
              const totalHeld = heldDeposits.reduce((sum, d) => sum + d.amount_paid, 0);
              const totalArrearsAllocated = Object.values(arrearsAllocations).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
              const totalDamages = parseInt(damagesAmount) || 0;
              const finalRefund = Math.max(0, totalHeld - totalArrearsAllocated - totalDamages);
              const exceedsDeposit = totalArrearsAllocated + totalDamages > totalHeld;

              return (
                <div className="space-y-3">
                  {/* Held Deposits Summary */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                    <p className="text-xs font-semibold text-emerald-950">Held Deposits</p>
                    <div className="space-y-1 text-[11px] text-emerald-700">
                      {heldDeposits.map((d) => (
                        <div key={d.id} className="flex justify-between">
                          <span>{d.deposit_type}</span>
                          <span className="font-bold">{formatKES(d.amount_paid)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-emerald-200 pt-1 font-bold text-emerald-950 mt-1">
                        <span>Total Held</span>
                        <span>{formatKES(totalHeld)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Apply to Rent Arrears */}
                  {unpaidInvoices.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-primary" /> Apply to Rent Arrears
                      </Label>
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {unpaidInvoices.map((inv) => {
                          const maxAlloc = inv.total - (inv.amount_paid || 0);
                          return (
                            <div key={inv.id} className="flex flex-col space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                              <div className="flex justify-between text-[11px] font-semibold text-foreground">
                                <span>{inv.month_for}</span>
                                <span className="text-red-600">Owed: {formatKES(maxAlloc)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground shrink-0">Apply KES</span>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={arrearsAllocations[inv.id] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const num = Math.min(Math.max(0, parseInt(val) || 0), maxAlloc);
                                    setArrearsAllocations({ ...arrearsAllocations, [inv.id]: val === "" ? "" : num.toString() });
                                  }}
                                  className="h-7 text-xs flex-1 px-2"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Deduct for Damages */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-orange-500" /> Deduct for Damages / Repairs
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground shrink-0">KES</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={damagesAmount}
                        onChange={(e) => setDamagesAmount(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0).toString())}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                    <Input
                      type="text"
                      placeholder="Description of damages (e.g. broken window, repainting)"
                      value={damagesDescription}
                      onChange={(e) => setDamagesDescription(e.target.value)}
                      className="h-8 text-[11px]"
                    />
                  </div>

                  {/* Refund summary */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total Held:</span>
                      <span className="font-semibold text-foreground">{formatKES(totalHeld)}</span>
                    </div>
                    {totalArrearsAllocated > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Applied to Arrears:</span>
                        <span className="font-semibold text-red-600">-{formatKES(totalArrearsAllocated)}</span>
                      </div>
                    )}
                    {totalDamages > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Applied to Damages:</span>
                        <span className="font-semibold text-red-600">-{formatKES(totalDamages)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-emerald-700">
                      <span>Net Refund to Tenant:</span>
                      <span>{formatKES(finalRefund)}</span>
                    </div>
                  </div>

                  {exceedsDeposit && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-[11px] rounded-lg p-2.5 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Deductions exceed total held deposit of {formatKES(totalHeld)}!</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div>
              <Label className="text-xs">Inspection Report (After Check-out)</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setAfterFile(e.target.files?.[0])} className="mt-1" />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={savingCheckout || (() => {
                const totalHeld = heldDeposits.reduce((sum, d) => sum + d.amount_paid, 0);
                const totalArr = Object.values(arrearsAllocations).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
                const totalDmg = parseInt(damagesAmount) || 0;
                return totalArr + totalDmg > totalHeld;
              })()}
            >
              {savingCheckout ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing Check-out...</>
              ) : (
                activeEviction ? "Enforce Eviction & Terminate Lease" : "Confirm & Terminate Lease"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Eviction Notice Dialog */}
      <Dialog open={showEvictionForm} onOpenChange={setShowEvictionForm}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Issue Eviction Notice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEvictionSubmit} className="space-y-4 pt-2">
            <div>
              <Label>Reason/Breach Type *</Label>
              <Select
                value={evictionForm.breachType}
                onValueChange={(v) => setEvictionForm({ ...evictionForm, breachType: v })}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rent Arrears">Rent Arrears / Outstanding Dues</SelectItem>
                  <SelectItem value="Property Damage">Severe Property Damage</SelectItem>
                  <SelectItem value="Unauthorized Subletting">Unauthorized Subletting</SelectItem>
                  <SelectItem value="Agreement Breach">Other Agreement Breach</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Notice Days *</Label>
                <Input
                  type="number"
                  value={evictionForm.noticePeriod}
                  onChange={(e) => setEvictionForm({ ...evictionForm, noticePeriod: e.target.value })}
                  required
                  className="h-10 text-xs"
                />
              </div>
              <div>
                <Label>Termination Date *</Label>
                <Input
                  type="date"
                  value={evictionForm.terminationDate}
                  onChange={(e) => setEvictionForm({ ...evictionForm, terminationDate: e.target.value })}
                  required
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <div>
              <Label>Eviction Notice File (PDF/Image)</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setEvictionForm({ ...evictionForm, letterFile: e.target.files?.[0] })}
                className="h-10 text-xs"
              />
            </div>

            <Button type="submit" className="w-full h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={submittingEviction || !evictionForm.terminationDate}>
              {submittingEviction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Issuing Eviction Notice...
                </>
              ) : (
                "Issue Eviction Notice"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}