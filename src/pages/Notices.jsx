import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { entities, integrations } from "@/api/supabaseClient";
import { Bell, Send, Mail, Phone, ShieldAlert, FileText, CheckCircle2, AlertCircle, X, Check, Loader2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

function daysUntil(dateStr) {
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

export default function Notices() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vacate"); // "vacate" | "evictions" | "reminders"
  
  // States
  const [vacateNotices, setVacateNotices] = useState([]);
  const [evictions, setEvictions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tenants, setTenants] = useState([]);
  
  // Reminders states
  const [sendingReminders, setSendingReminders] = useState(false);

  // Move-out states
  const [selectedNoticeForMoveout, setSelectedNoticeForMoveout] = useState(null);
  const [checkoutDate, setCheckoutDate] = useState("");
  const [afterFile, setAfterFile] = useState(null);
  const [heldDeposits, setHeldDeposits] = useState([]);
  const [processingVacate, setProcessingVacate] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vNotices, evs, inv, ten] = await Promise.all([
        supabase.from("vacate_notices").select("*").order("created_date", { ascending: false }),
        supabase.from("evictions").select("*").order("created_date", { ascending: false }),
        entities.Invoice.list(),
        entities.Tenant.list(),
      ]);
      setVacateNotices(vNotices.data || []);
      setEvictions(evs.data || []);
      setInvoices(inv || []);
      setTenants(ten || []);
    } catch (e) {
      console.error("Error loading notices page details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedNoticeForMoveout) {
      setCheckoutDate(selectedNoticeForMoveout.expected_vacate_date || new Date().toISOString().split("T")[0]);
      loadHeldDeposits(selectedNoticeForMoveout.tenant_id);
    } else {
      setHeldDeposits([]);
      setAfterFile(null);
    }
  }, [selectedNoticeForMoveout]);

  const loadHeldDeposits = async (tenantId) => {
    try {
      const { data, error } = await supabase
        .from("tenant_deposits")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "Held");
      if (!error) {
        setHeldDeposits(data || []);
      }
    } catch (e) {
      console.error("Error loading held deposits for notices moveout:", e);
    }
  };

  const handleFinalizeMoveout = async (e) => {
    e.preventDefault();
    if (!selectedNoticeForMoveout || !checkoutDate) return;
    setProcessingVacate(true);
    try {
      const notice = selectedNoticeForMoveout;
      
      // Fetch unit_id directly from the tenants table (guarantees robust unit clearing even if lease is null)
      const { data: tenantData, error: tenantErr } = await supabase
        .from("tenants")
        .select("unit_id")
        .eq("id", notice.tenant_id)
        .single();
      if (tenantErr) throw tenantErr;
      const unitId = tenantData.unit_id;

      // 1. Upload files
      let uploadedAfterUrl = null;
      if (afterFile) {
        const res = await integrations.Core.UploadFile({ file: afterFile });
        uploadedAfterUrl = res?.url || null;
      }

      // 2. Terminate the Lease (if lease_id is linked)
      if (notice.lease_id) {
        const { error: leaseTermErr } = await supabase
          .from("leases")
          .update({
            status: "Terminated",
            inspection_after_url: uploadedAfterUrl,
            end_date: checkoutDate,
          })
          .eq("id", notice.lease_id);
        if (leaseTermErr) throw leaseTermErr;
      }

      // 3. Inactivate the Tenant profile
      const { error: tenantStatusErr } = await supabase
        .from("tenants")
        .update({
          status: "Inactive",
          lease_end: checkoutDate,
        })
        .eq("id", notice.tenant_id);
      if (tenantStatusErr) throw tenantStatusErr;

      // 4. Reset the Unit back to Vacant
      const { error: unitErr } = await supabase
        .from("units")
        .update({
          status: "Vacant",
          tenant_id: null,
          tenant_name: null,
          monthly_rent: 0,
        })
        .eq("id", unitId);
      if (unitErr) throw unitErr;

      // 5. Refund held deposits
      await supabase
        .from("tenant_deposits")
        .update({ status: "Refunded" })
        .eq("tenant_id", notice.tenant_id)
        .eq("status", "Held");

      // 6. Complete the notice status
      const { error: noticeErr } = await supabase
        .from("vacate_notices")
        .update({ status: "Completed" })
        .eq("id", notice.id);
      if (noticeErr) throw noticeErr;

      toast({ title: "Move-out processed successfully!" });
      setSelectedNoticeForMoveout(null);
      loadData();
    } catch (err) {
      console.error("Move-out error:", err);
      toast({ title: "Failed to process move-out", description: err.message, variant: "destructive" });
    } finally {
      setProcessingVacate(false);
    }
  };

  const tenantById = (id) => tenants.find((t) => t.id === id);

  // Eviction actions
  const handleRescindEviction = async (evictionId) => {
    try {
      const { error } = await supabase
        .from("evictions")
        .update({ status: "Rescinded" })
        .eq("id", evictionId);
      if (error) throw error;
      toast({ title: "Eviction notice rescinded." });
      loadData();
    } catch (err) {
      toast({ title: "Failed to rescind eviction notice", variant: "destructive" });
    }
  };

  // Reminders Filter
  const remindersDue = invoices
    .filter(
      (i) =>
        i.status === "Unpaid" &&
        i.due_date &&
        !i.reminder_sent &&
        daysUntil(i.due_date) <= 3
    )
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const handleSendReminders = async () => {
    setSendingReminders(true);
    let sent = 0;
    try {
      for (const inv of remindersDue) {
        const tenant = tenantById(inv.tenant_id);
        if (tenant?.email) {
          try {
            const body = `Hello ${tenant.full_name},\n\nThis is a friendly reminder that your rent of ${formatKES(
              inv.total
            )} for ${inv.month_for} (Unit ${inv.unit_number}) is due on ${inv.due_date}.\n\nPlease make your payment via M-Pesa before the due date to avoid late fees.\n\nThank you,\nApartaBase`;
            await integrations.Core.SendEmail({
              to: tenant.email,
              from_name: "ApartaBase",
              subject: `Rent Due Reminder — ${inv.month_for}`,
              body,
            });
            await entities.Invoice.update(inv.id, { reminder_sent: true });
            sent++;
          } catch (e) {
            /* skip */
          }
        }
      }
      toast({ title: `${sent} reminder${sent === 1 ? "" : "s"} sent` });
      loadData();
    } catch (e) {
      toast({ title: "Error sending reminders", variant: "destructive" });
    } finally {
      setSendingReminders(false);
    }
  };

  const pendingVacatesCount = vacateNotices.filter((n) => n.status === "Pending").length;

  return (
    <div className="pb-24">
      <PageHeader
        title="Notices"
        subtitle={`${pendingVacatesCount} pending vacate requests`}
      />

      <div className="max-w-lg mx-auto px-4 py-3 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex bg-muted/80 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab("vacate")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all relative ${
              activeTab === "vacate" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Vacate Notices
            {pendingVacatesCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 text-[9px] bg-amber-500 text-white rounded-full font-bold">
                {pendingVacatesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("evictions")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "evictions" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Evictions
          </button>
          <button
            onClick={() => setActiveTab("reminders")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "reminders" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Rent Reminders
            {remindersDue.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 text-[9px] bg-primary text-primary-foreground rounded-full font-bold">
                {remindersDue.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Vacate Notices Tab */}
            {activeTab === "vacate" && (
              <div className="space-y-2.5">
                {vacateNotices.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No Vacate Notices"
                    description="When tenants intend to move out, their notices will appear here."
                  />
                ) : (
                  vacateNotices.map((n) => {
                    const tenant = tenantById(n.tenant_id);
                    return (
                      <div key={n.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-sm">{tenant?.full_name || "Unknown Tenant"}</h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Unit {tenant?.unit_number || "—"} · {tenant?.property_name || "—"}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            n.status === "Approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : n.status === "Pending"
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : n.status === "Completed"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-red-50 text-red-700 border border-red-100"
                          }`}>
                            {n.status}
                          </span>
                        </div>

                        {n.reason && (
                          <div className="p-2.5 bg-muted/40 rounded-lg text-xs italic border border-border/30">
                            "{n.reason}"
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs border-t border-border/40 pt-2.5">
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground text-[10px] uppercase block font-bold">Expected Vacate Date</span>
                            <span className="font-semibold text-foreground">{n.expected_vacate_date}</span>
                          </div>

                          {n.status === "Pending" && (
                            <Button
                              onClick={() => setSelectedNoticeForMoveout(n)}
                              size="sm"
                              className="h-8 text-xs font-semibold px-4 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve & Vacate
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Evictions Tab */}
            {activeTab === "evictions" && (
              <div className="space-y-2.5">
                {evictions.length === 0 ? (
                  <EmptyState
                    icon={ShieldAlert}
                    title="No Evictions Issued"
                    description="Active eviction notices issued due to agreement breach will show here."
                  />
                ) : (
                  evictions.map((e) => {
                    const tenant = tenantById(e.tenant_id);
                    return (
                      <div key={e.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-sm">{tenant?.full_name || "Unknown Tenant"}</h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Unit {tenant?.unit_number || "—"} · {tenant?.property_name || "—"}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            e.status === "Issued"
                              ? "bg-red-50 text-red-700 border border-red-100"
                              : e.status === "Enforced"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {e.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/30">
                          <div>
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Breach</span>
                            <span className="font-semibold text-foreground font-mono">{e.breach_type}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Termination Date</span>
                            <span className="font-semibold text-foreground">{e.termination_date}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs border-t border-border/40 pt-2.5">
                          <div>
                            {e.eviction_letter_url ? (
                              <a
                                href={e.eviction_letter_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                              >
                                <FileText className="w-3.5 h-3.5" /> Eviction Letter
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">No file attached</span>
                            )}
                          </div>

                          {e.status === "Issued" && (
                            <Button
                              onClick={() => handleRescindEviction(e.id)}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-semibold px-3 text-red-500 border-red-200 hover:bg-red-50"
                            >
                              Rescind Eviction
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Rent Reminders Tab */}
            {activeTab === "reminders" && (
              <div className="space-y-4">
                {remindersDue.length === 0 ? (
                  <EmptyState
                    icon={Bell}
                    title="All caught up"
                    description="No tenants are due within the next 3 days."
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {remindersDue.length} tenant{remindersDue.length === 1 ? "" : "s"} due within 3 days
                      </p>
                      <Button size="sm" onClick={handleSendReminders} disabled={sendingReminders} className="h-8 text-xs">
                        <Send className="w-3.5 h-3.5 mr-1" />
                        {sendingReminders ? "Sending..." : "Send Reminders"}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {remindersDue.map((inv) => {
                        const tenant = tenantById(inv.tenant_id);
                        const d = daysUntil(inv.due_date);
                        const overdue = d < 0;
                        return (
                          <div key={inv.id} className="bg-card rounded-xl border border-border p-3.5 shadow-sm flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-foreground truncate">{tenant?.full_name || "—"}</h4>
                              <p className="text-muted-foreground mt-0.5 text-[11px]">
                                Unit {inv.unit_number} · {inv.property_name}
                              </p>
                              <div className="flex gap-2.5 mt-2">
                                {tenant?.email && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Mail className="w-3 h-3 text-primary" /> {tenant.email}
                                  </span>
                                )}
                                {tenant?.phone && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Phone className="w-3 h-3 text-primary" /> {tenant.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-foreground">{formatKES(inv.total)}</p>
                              <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1.5 ${
                                overdue ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                              }`}>
                                {overdue ? "Overdue" : `Due in ${d} days`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Move-out Vacate finalization Dialog */}
      <Dialog open={!!selectedNoticeForMoveout} onOpenChange={(open) => !open && setSelectedNoticeForMoveout(null)}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Approve Vacate & Finalize Move-out</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFinalizeMoveout} className="space-y-4 pt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Move-out Confirmation</p>
                <p className="text-[11px] text-amber-700">Approving this notice terminates the active lease, marks the tenant as Inactive, and refunds held deposits.</p>
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
                    <span>Total Refunded</span>
                    <span>{formatKES(heldDeposits.reduce((sum, d) => sum + d.amount_paid, 0))}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Checkout End Date *</Label>
              <Input
                type="date"
                value={checkoutDate}
                onChange={(e) => setCheckoutDate(e.target.value)}
                required
                className="h-10 text-xs"
              />
            </div>

            <div>
              <Label>Inspection Report (After Move-out)</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setAfterFile(e.target.files?.[0])}
                className="h-10 text-xs"
              />
            </div>

            <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={processingVacate}>
              {processingVacate ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> finalising Move-out...
                </>
              ) : (
                "Finalize Move-out & Complete Notice"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
