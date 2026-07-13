import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { entities, recalculateInvoiceSettlement } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Phone,
  Mail,
  User,
  Calendar,
  DoorOpen,
  Home,
  Wallet,
  CheckCircle2,
  Clock,
  Wrench,
  FileText,
  CreditCard,
  AlertCircle
} from "lucide-react";

export default function TenantDetail() {
  const { id } = useParams();
  const { profile, demoRole } = useAuth();
  const isAgent = demoRole === "agent" || profile?.role === "agent";
  const { toast } = useToast();

  const [tenant, setTenant] = useState(null);
  const [lease, setLease] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [maintenanceReqs, setMaintenanceReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [verifyingPaymentId, setVerifyingPaymentId] = useState(null);
  const [verifyingDepositId, setVerifyingDepositId] = useState(null);

  const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // 1. Fetch tenant basic info
      const tenantData = await entities.Tenant.get(id);
      setTenant(tenantData);

      if (tenantData) {
        // 2. Fetch associated data concurrently
        const [leaseRes, invoicesRes, paymentsRes, depositsRes, payoutsRes, maintenanceRes] = await Promise.all([
          supabase.from("leases").select("*").eq("tenant_id", id).eq("status", "Active").maybeSingle(),
          supabase.from("invoices").select("*").eq("tenant_id", id).order("created_date", { ascending: false }),
          supabase.from("payments").select("*").eq("tenant_id", id).order("payment_date", { ascending: false }),
          supabase.from("tenant_deposits").select("*").eq("tenant_id", id),
          entities.LandlordPayout.list(),
          supabase.from("maintenance_requests").select("*").eq("tenant_id", id).order("created_date", { ascending: false }),
        ]);

        setLease(leaseRes.data || null);
        setInvoices(invoicesRes.data || []);
        setPayments(paymentsRes.data || []);
        setDeposits(depositsRes.data || []);
        setPayouts(payoutsRes || []);
        setMaintenanceReqs(maintenanceRes.data || []);
      }
    } catch (err) {
      console.error("Error loading tenant details:", err);
      toast({ title: "Failed to load tenant details", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (p) => {
    setVerifyingPaymentId(p.id);
    try {
      // 1. Mark this payment as Verified
      const { error: payErr } = await supabase
        .from("payments")
        .update({ status: "Verified", notes: "Verified by agent on tenant page" })
        .eq("id", p.id);
      if (payErr) throw payErr;

      // 2. Find the linked invoice id
      let invoiceQuery = supabase.from("invoices").select("id");
      if (p.invoice_number) {
        invoiceQuery = invoiceQuery.eq("invoice_number", p.invoice_number);
      } else {
        invoiceQuery = invoiceQuery
          .eq("unit_id", p.unit_id)
          .eq("tenant_id", p.tenant_id)
          .eq("month_for", p.month_for);
      }
      const { data: invData, error: invErr } = await invoiceQuery.maybeSingle();

      // 3. System recalculates settlement from all verified payments
      if (!invErr && invData) {
        await recalculateInvoiceSettlement(invData.id);
      }
      toast({ title: "Payment verified — receipt available!" });
      loadData();
    } catch (e) {
      toast({ title: "Verification failed", description: e.message, variant: "destructive" });
    } finally {
      setVerifyingPaymentId(null);
    }
  };

  const handleVerifyDepositRefund = async (depId) => {
    setVerifyingDepositId(depId);
    try {
      const { error } = await supabase.from("tenant_deposits").update({ status: "Refunded" }).eq("id", depId);
      if (error) throw error;
      toast({ title: "Refund verified as paid to tenant!" });
      loadData();
    } catch (e) {
      toast({ title: "Failed to verify refund", description: e.message, variant: "destructive" });
    } finally {
      setVerifyingDepositId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <PageHeader title="Tenant Details" backPath="/tenants" />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div>
        <PageHeader title="Tenant Details" backPath="/tenants" />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-sm">Tenant Not Found</h3>
          <p className="text-xs text-muted-foreground mt-1">This tenant may have been deleted.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/tenants">Back to Tenants</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Financial statistics
  const totalPaid = payments
    .filter((p) => p.status === "Verified")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalOutstanding = invoices
    .filter((inv) => inv.status !== "Paid")
    .reduce((sum, inv) => sum + (inv.total - (inv.amount_paid || 0)), 0);

  const refundableDeposit = deposits
    .filter((d) => d.status === "Held")
    .reduce((sum, d) => sum + (d.amount_paid || 0), 0);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "payments", label: `Payments (${payments.length})` },
    { id: "invoices", label: `Invoices (${invoices.length})` },
    { id: "deposits", label: `Deposits (${deposits.length})` },
    { id: "maintenance", label: `Maintenance (${maintenanceReqs.length})` },
  ];

  return (
    <div>
      <PageHeader title={tenant.full_name} subtitle={tenant.status} backPath="/tenants" />

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl border border-border p-3 shadow-sm text-center">
            <span className="text-[10px] text-muted-foreground font-semibold block truncate uppercase">Paid</span>
            <p className="text-xs font-bold text-emerald-600 mt-1 truncate">{formatKES(totalPaid)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 shadow-sm text-center">
            <span className="text-[10px] text-muted-foreground font-semibold block truncate uppercase">Owed</span>
            <p className="text-xs font-bold text-red-500 mt-1 truncate">{formatKES(totalOutstanding)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 shadow-sm text-center">
            <span className="text-[10px] text-muted-foreground font-semibold block truncate uppercase">Deposits</span>
            <p className="text-xs font-bold text-indigo-600 mt-1 truncate">{formatKES(refundableDeposit)}</p>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-border overflow-x-auto no-scrollbar gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`py-2 px-2 text-[11px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="mt-2">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Lease info card */}
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5" /> Unit & Lease Information
                </h3>
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Property Name</span>
                    <span className="font-semibold">{tenant.property_name || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Unit Number</span>
                    <span className="font-semibold">{tenant.unit_number || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Monthly Rent</span>
                    <span className="font-semibold text-primary">{formatKES(tenant.monthly_rent)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Lease Start</span>
                    <span className="font-semibold">{tenant.lease_start || "—"}</span>
                  </div>
                  {tenant.status === "Inactive" && tenant.lease_end && (
                    <div className="flex justify-between items-center py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Lease End</span>
                      <span className="font-semibold text-red-500">{tenant.lease_end}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Details */}
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Contact Details
                </h3>
                <div className="space-y-2.5 pt-1 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone</span>
                    {tenant.phone ? (
                      <a href={`tel:${tenant.phone}`} className="font-semibold text-primary">{tenant.phone}</a>
                    ) : (
                      <span className="font-semibold text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email</span>
                    {tenant.email ? (
                      <a href={`mailto:${tenant.email}`} className="font-semibold text-primary truncate max-w-48 block">{tenant.email}</a>
                    ) : (
                      <span className="font-semibold text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">National ID</span>
                    <span className="font-semibold">{tenant.id_number || "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === "payments" && (
            <div className="space-y-2">
              {payments.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No Payments Recorded"
                  description="This tenant does not have any recorded transactions."
                />
              ) : (
                payments.map((p) => {
                  const isPending = p.status === "Pending";
                  return (
                    <div key={p.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-foreground">KES {p.amount?.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {p.month_for} · {p.payment_method}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                            p.status === "Verified"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : p.status === "Pending"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}>
                            {p.status}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{p.payment_date}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                        <span>Ref: <span className="font-medium text-foreground">{p.reference || "—"}</span></span>
                        {p.invoice_number && (
                          <span>Invoice: <span className="font-medium text-foreground">{p.invoice_number}</span></span>
                        )}
                      </div>

                      {isPending && isAgent && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleVerifyPayment(p)}
                            disabled={verifyingPaymentId === p.id}
                            className="h-7 text-[10px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {verifyingPaymentId === p.id ? "Verifying..." : "Verify Payment"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === "invoices" && (
            <div className="space-y-2">
              {invoices.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No Invoices Found"
                  description="There are no monthly or damages invoices for this tenant."
                />
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-foreground">{inv.invoice_number || "Draft Invoice"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {inv.month_for} · {inv.invoice_type || "Rent Invoice"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          inv.status === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : inv.status === "Partially Paid"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          {inv.status}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Due: {inv.due_date || "—"}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-border/40 pt-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Invoice Amount: </span>
                        <span className="font-semibold">{formatKES(inv.total)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Paid: </span>
                        <span className="font-semibold text-emerald-600">{formatKES(inv.amount_paid)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* DEPOSITS TAB */}
          {activeTab === "deposits" && (
            <div className="space-y-2">
              {deposits.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="No Deposits Ledger"
                  description="No refundable security deposits recorded for this tenant."
                />
              ) : (
                deposits.map((dep) => {
                  const linkedPayout = payouts.find((p) => p.id === dep.payout_id || p.linked_deposit_id === dep.id);
                  const canVerify = dep.status === "Pending" && linkedPayout?.status === "Confirmed" && isAgent;

                  return (
                    <div key={dep.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-foreground">{dep.deposit_type || "Security Deposit"}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Collected on check-in
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                            dep.status === "Held"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : dep.status === "Refunded"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {dep.status}
                          </span>
                          <p className="text-xs font-bold text-foreground mt-1">{formatKES(dep.amount_paid)}</p>
                        </div>
                      </div>

                      {dep.status === "Pending" && (
                        <div className="bg-muted/65 p-2 rounded-lg border border-border/20 mt-1 flex items-center justify-between text-[10px]">
                          <div className="text-muted-foreground">
                            {linkedPayout ? (
                              linkedPayout.status === "Confirmed" ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Landlord Paid
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Awaiting Landlord Payout
                                </span>
                              )
                            ) : (
                              <span className="italic text-muted-foreground">No payout request created</span>
                            )}
                          </div>

                          {canVerify && (
                            <Button
                              size="sm"
                              onClick={() => handleVerifyDepositRefund(dep.id)}
                              disabled={verifyingDepositId === dep.id}
                              className="h-6 text-[9px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {verifyingDepositId === dep.id ? "Updating..." : "Confirm Refunded"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* MAINTENANCE TAB */}
          {activeTab === "maintenance" && (
            <div className="space-y-2">
              {maintenanceReqs.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="No Maintenance Issues"
                  description="This tenant hasn't submitted any repair requests."
                />
              ) : (
                maintenanceReqs.map((req) => {
                  const statusColors = {
                    Open: "bg-amber-50 text-amber-700 border border-amber-200",
                    "In Progress": "bg-blue-50 text-blue-700 border border-blue-200",
                    Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
                    Resolved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
                  };
                  const priorityColors = {
                    Low: "bg-gray-100 text-gray-700",
                    Medium: "bg-orange-50 text-orange-700",
                    High: "bg-red-50 text-red-700",
                  };

                  return (
                    <div key={req.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">{req.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Category: {req.category} · Priority: <span className="font-semibold">{req.priority}</span>
                          </p>
                        </div>
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColors[req.status] || "bg-gray-100 text-gray-700"}`}>
                          {req.status}
                        </span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/30 mt-1">
                        {req.description}
                      </p>

                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                        <span>Reported: {req.created_date || "—"}</span>
                        <span>Repair Cost: <span className="font-semibold text-foreground">{req.cost ? formatKES(req.cost) : "Not set"}</span></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
