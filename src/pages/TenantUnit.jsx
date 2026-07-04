import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { DoorOpen, Phone, Calendar, Home, User as UserIcon, FileText, FileCheck, Wallet, AlertTriangle, Loader2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function TenantUnit() {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [lease, setLease] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [vacateNotice, setVacateNotice] = useState(null);
  const [activeEviction, setActiveEviction] = useState(null);
  const [vacateForm, setVacateForm] = useState({ date: "", reason: "" });
  const [submittingNotice, setSubmittingNotice] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadTenantLease = async () => {
      if (!user) return;
      try {
        // 1. Fetch active tenant linked to user
        const { data: tenantData, error: tenantErr } = await supabase
          .from("tenants")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "Active")
          .maybeSingle();

        if (tenantErr) throw tenantErr;
        
        if (tenantData) {
          setTenant(tenantData);
          
          // 2. Fetch active lease linked to this tenant
          const { data: leaseData, error: leaseErr } = await supabase
            .from("leases")
            .select("*")
            .eq("tenant_id", tenantData.id)
            .eq("status", "Active")
            .maybeSingle();

          if (leaseErr) throw leaseErr;
          setLease(leaseData);

          // 3. Fetch deposits linked to this tenant
          const { data: depositsData } = await supabase
            .from("tenant_deposits")
            .select("*")
            .eq("tenant_id", tenantData.id);
          setDeposits(depositsData || []);

          // 4. Fetch active vacate notice
          const { data: notices } = await supabase
            .from("vacate_notices")
            .select("*")
            .eq("tenant_id", tenantData.id)
            .in("status", ["Pending", "Approved"])
            .order("created_date", { ascending: false });
          if (notices && notices.length > 0) {
            setVacateNotice(notices[0]);
          }

          // 5. Fetch active eviction notice
          const { data: evs } = await supabase
            .from("evictions")
            .select("*")
            .eq("tenant_id", tenantData.id)
            .eq("status", "Issued")
            .order("created_date", { ascending: false });
          if (evs && evs.length > 0) {
            setActiveEviction(evs[0]);
          }
        }
      } catch (e) {
        console.error("Error loading tenant details:", e);
      } finally {
        setLoading(false);
      }
    };
    loadTenantLease();
  }, [user]);

  const handleNoticeSubmit = async (e) => {
    e.preventDefault();
    if (!vacateForm.date) return;
    setSubmittingNotice(true);
    try {
      const { error } = await supabase
        .from("vacate_notices")
        .insert({
          tenant_id: tenant.id,
          lease_id: lease ? lease.id : null,
          expected_vacate_date: vacateForm.date,
          reason: vacateForm.reason,
          status: "Pending",
        });
      if (error) throw error;
      toast({ title: "Notice to vacate submitted!" });
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingNotice(false);
    }
  };

  const handleCancelNotice = async () => {
    if (!vacateNotice) return;
    try {
      const { error } = await supabase
        .from("vacate_notices")
        .update({ status: "Cancelled" })
        .eq("id", vacateNotice.id);
      if (error) throw error;
      toast({ title: "Notice cancelled successfully!" });
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast({ title: "Cancellation failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return (<><PageHeader title="My Unit" backPath="/" /><LoadingSpinner /></>);
  
  if (!tenant) {
    return (
      <div>
        <PageHeader title="My Unit" backPath="/" />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <DoorOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-sm">No Unit Assigned</h3>
          <p className="text-xs text-muted-foreground mt-1">Contact your agent to check you into a unit.</p>
        </div>
      </div>
    );
  }

  const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

  const details = [
    { icon: Home, label: "Property Name", value: tenant.property_name },
    { icon: DoorOpen, label: "Unit Number", value: tenant.unit_number },
    { icon: Calendar, label: "Monthly Rent", value: formatKES(tenant.monthly_rent) },
    { icon: Calendar, label: "Lease Start Date", value: tenant.lease_start || "—" },
    { icon: Calendar, label: "Lease End Date", value: tenant.lease_end || "No end date set" },
    { icon: Phone, label: "Mobile Number", value: tenant.phone },
    { icon: UserIcon, label: "National ID Number", value: tenant.id_number || "—" },
  ];

  return (
    <div className="pb-24">
      <PageHeader title="My Unit" subtitle={tenant.property_name} backPath="/" />
      
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Eviction Warning Banner */}
        {activeEviction && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex gap-3.5 shadow-sm">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-bold text-red-900">LEGAL NOTICE: Eviction Issued</p>
              <p className="text-xs text-red-700 leading-relaxed">
                You are required to vacate unit <span className="font-semibold">{tenant.unit_number}</span> by <span className="font-semibold">{activeEviction.termination_date}</span> due to lease agreement breach: <span className="font-semibold font-mono bg-red-100 px-1 py-0.5 rounded text-red-800">{activeEviction.breach_type}</span>.
              </p>
              {activeEviction.eviction_letter_url && (
                <a
                  href={activeEviction.eviction_letter_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-red-700 font-semibold hover:underline bg-white px-3 py-1.5 rounded-lg border border-red-200"
                >
                  <FileText className="w-3.5 h-3.5" /> View Eviction Letter
                </a>
              )}
            </div>
          </div>
        )}

        {/* Unit header badge card */}
        <div className="bg-primary text-primary-foreground rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/10">
              <DoorOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-primary-foreground/70">Your Active Unit</p>
              <h2 className="text-xl font-bold">{tenant.unit_number}</h2>
              <p className="text-xs text-primary-foreground/80 mt-0.5">{tenant.property_name}</p>
            </div>
          </div>
        </div>

        {/* Tenant Profile details */}
        <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
          {details.map((d, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <d.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-sm font-medium truncate">{d.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Active Lease Documents */}
        {lease && (
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <FileText className="w-4.5 h-4.5 text-primary" />
              <h3 className="text-sm font-bold">Lease Documents</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Lease Rent</p>
                <p className="font-semibold">{formatKES(lease.monthly_rent)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Security Deposit</p>
                <p className="font-semibold">{formatKES(lease.deposit)}</p>
              </div>
            </div>

            {/* Inspections rendering side-by-side */}
            <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-2.5">
              <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Inspection Reports</h5>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="space-y-1">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase">1. Before Check-in</p>
                  {lease.inspection_before_url ? (
                    <a
                      href={lease.inspection_before_url}
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
                  {lease.inspection_after_url ? (
                    <a
                      href={lease.inspection_after_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                    >
                      <FileCheck className="w-3.5 h-3.5 text-red-500" /> View After File
                    </a>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">Pending checkout</p>
                  )}
                </div>
              </div>
            </div>

            {lease.lease_agreement_url && (
              <a
                href={lease.lease_agreement_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg hover:bg-muted border border-border text-xs text-primary font-medium transition-colors"
              >
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" /> Download Signed Lease Agreement
              </a>
            )}
          </div>
        )}

        {/* Deposits Ledger */}
        {deposits.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Wallet className="w-4.5 h-4.5 text-primary" />
              <h3 className="text-sm font-bold">Refundable Deposits Ledger</h3>
            </div>
            <div className="space-y-2">
              {deposits.map((d) => (
                <div key={d.id} className="flex justify-between items-center text-xs p-2.5 bg-muted/30 rounded-lg border border-border/30">
                  <div>
                    <p className="font-semibold text-foreground">{d.deposit_type}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Billed: {formatKES(d.amount_billed)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{formatKES(d.amount_paid)} paid</p>
                    <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      d.status === "Held" 
                        ? "bg-emerald-100 text-emerald-800" 
                        : d.status === "Refunded" 
                        ? "bg-indigo-100 text-indigo-800" 
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notice to Vacate Card */}
        {tenant && (
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <FileText className="w-4.5 h-4.5 text-primary" />
              <h3 className="text-sm font-bold">Notice to Vacate</h3>
            </div>

            {vacateNotice ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Expected Move-out Date</span>
                  <span className="font-semibold text-foreground">{vacateNotice.expected_vacate_date}</span>
                </div>
                {vacateNotice.reason && (
                  <div className="text-xs">
                    <span className="text-muted-foreground block mb-1">Reason</span>
                    <p className="p-2.5 bg-muted/40 rounded-lg text-foreground border border-border/30 italic">
                      "{vacateNotice.reason}"
                    </p>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs border-t border-border/40 pt-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    vacateNotice.status === "Approved"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {vacateNotice.status} Notice
                  </span>
                </div>
                
                {vacateNotice.status === "Pending" && (
                  <Button
                    onClick={handleCancelNotice}
                    variant="outline"
                    className="w-full h-10 text-xs font-semibold text-red-500 border-red-200 hover:bg-red-50 mt-1"
                  >
                    Cancel Notice
                  </Button>
                )}
              </div>
            ) : (
              <form onSubmit={handleNoticeSubmit} className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  Intending to move out? Submit your vacate notice here to notify your property agent.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="vacate-date" className="text-[10px] uppercase font-bold text-muted-foreground">
                    Expected Move-out Date *
                  </Label>
                  <Input
                    id="vacate-date"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={vacateForm.date}
                    onChange={(e) => setVacateForm({ ...vacateForm, date: e.target.value })}
                    required
                    className="h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vacate-reason" className="text-[10px] uppercase font-bold text-muted-foreground">
                    Reason for Vacating
                  </Label>
                  <textarea
                    id="vacate-reason"
                    placeholder="Optional details..."
                    rows={3}
                    value={vacateForm.reason}
                    onChange={(e) => setVacateForm({ ...vacateForm, reason: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-input bg-transparent focus:ring-1 focus:ring-primary outline-none resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submittingNotice || !vacateForm.date}
                  className="w-full h-10 text-xs font-semibold"
                >
                  {submittingNotice ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting Notice...
                    </>
                  ) : (
                    "Submit Vacate Notice"
                  )}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}