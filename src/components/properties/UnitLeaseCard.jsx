import React, { useState, useEffect, useRef } from "react";
import { FileText, FileCheck, LogOut, Calendar, Plus, Loader2, FileDown, AlertCircle } from "lucide-react";
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

    setSavingCheckout(true);
    try {
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
          end_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", activeLease.id);

      if (leaseError) throw leaseError;

      // 2. Inactivate the Tenant profile
      if (activeLease.tenant_id) {
        const { error: tenantError } = await supabase
          .from("tenants")
          .update({
            status: "Inactive",
            lease_end: new Date().toISOString().split("T")[0],
          })
          .eq("id", activeLease.tenant_id);

        if (tenantError) throw tenantError;
      }

      // 3. Reset the Unit back to Vacant
      const { error: unitError } = await supabase
        .from("units")
        .update({
          status: "Vacant",
          tenant_id: null,
          tenant_name: null,
          monthly_rent: 0,
        })
        .eq("id", unit.id);

      if (unitError) throw unitError;

      // 4. Update status of held deposits to 'Refunded'
      if (activeLease.tenant_id) {
        await supabase
          .from("tenant_deposits")
          .update({ status: "Refunded" })
          .eq("tenant_id", activeLease.tenant_id)
          .eq("status", "Held");

        // Update active vacate notice to Completed
        if (vacateNotice) {
          await supabase
            .from("vacate_notices")
            .update({ status: "Completed" })
            .eq("id", vacateNotice.id);
        }

        // Update active eviction notice to Enforced
        if (activeEviction) {
          await supabase
            .from("evictions")
            .update({ status: "Enforced" })
            .eq("id", activeEviction.id);
        }
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
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Confirm Tenant Check-out</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Check-out Warning</p>
                <p className="text-[11px] text-amber-700">This will terminate the active lease immediately, mark the tenant as Inactive, and set this unit status back to Vacant.</p>
              </div>
            </div>

            {heldDeposits.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <p className="text-xs font-semibold text-emerald-950">Refundable Deposits Ledger</p>
                <div className="space-y-1 text-[11px] text-emerald-700">
                  {heldDeposits.map((d) => (
                    <div key={d.id} className="flex justify-between">
                      <span>{d.deposit_type}</span>
                      <span className="font-bold">{formatKES(d.amount_paid)} (Paid of {formatKES(d.amount_billed)})</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-emerald-200 pt-1 font-bold text-emerald-950 mt-1">
                    <span>Total Held</span>
                    <span>{formatKES(heldDeposits.reduce((sum, d) => sum + d.amount_paid, 0))}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Inspection Report (After Check-out)</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setAfterFile(e.target.files?.[0])} />
            </div>

            <Button type="submit" className="w-full h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={savingCheckout}>
              {savingCheckout ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Terminating Lease
                </>
              ) : (
                "Confirm & Terminate Lease"
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