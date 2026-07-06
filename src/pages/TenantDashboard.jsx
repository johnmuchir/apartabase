import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { DoorOpen, CreditCard, CheckCircle2, Clock, LogOut, TrendingUp, AlertCircle, Wallet, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import StatCard from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

export default function TenantDashboard() {
  const { signOut, profile, user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    try {
      if (!user) return;
      let { data: tenantData } = await supabase
        .from("tenants").select("*")
        .eq("user_id", user.id).eq("status", "Active").maybeSingle();

      if (!tenantData) {
        // Prioritize active profiles matching user email first
        const { data: activeByEmail } = await supabase
          .from("tenants").select("*").eq("email", user.email).eq("status", "Active").limit(1);
        
        if (activeByEmail && activeByEmail.length > 0) {
          tenantData = activeByEmail[0];
        } else {
          // If no active, search for latest matching profile (could be inactive/vacated)
          const { data: anyByEmail } = await supabase
            .from("tenants").select("*").eq("email", user.email).order("created_date", { ascending: false }).limit(1);
          tenantData = anyByEmail?.[0] ?? null;
        }
      }

      if (tenantData && tenantData.status === "Active") {
        setTenant(tenantData);
        const [invRes, payRes] = await Promise.all([
          supabase.from("invoices").select("*").eq("tenant_id", tenantData.id).order("created_date", { ascending: false }),
          supabase.from("payments").select("*").eq("tenant_id", tenantData.id).order("payment_date", { ascending: false }),
        ]);
        setInvoices(invRes.data || []);
        setPayments(payRes.data || []);
      } else if (tenantData) {
        setTenant(tenantData); // Still save it to display move-out summary in dormant state screen
        // Fetch deposit settlement for the dormant/inactive tenant
        const { data: depData } = await supabase
          .from("tenant_deposits")
          .select("*")
          .eq("tenant_id", tenantData.id)
          .order("created_date", { ascending: true });
        setDeposits(depData || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return (<><PageHeader title="Loading..." /><LoadingSpinner /></>);

  if (!tenant || tenant.status === "Inactive") {
    const totalPaid = deposits.reduce((s, d) => s + d.amount_paid, 0);
    const totalRefunded = deposits.filter((d) => d.status === "Refunded").reduce((s, d) => s + d.amount_paid, 0);
    const totalApplied = deposits.filter((d) => d.status === "Applied").reduce((s, d) => s + d.amount_paid, 0);
    const hasDeposits = deposits.length > 0;
    const hasSettlement = deposits.some((d) => d.status === "Refunded" || d.status === "Applied");

    return (
      <div>
        <PageHeader title="ApartaBase" />
        <div className="max-w-lg mx-auto px-4 py-10 space-y-4">
          {/* Dormant card */}
          <div className="bg-muted/40 border border-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-foreground">Tenancy Dormant</h3>
              {tenant && tenant.status === "Inactive" ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You successfully checked out of unit <span className="font-semibold text-foreground">{tenant.unit_number}</span> at <span className="font-semibold text-foreground">{tenant.property_name}</span> on <span className="font-semibold text-foreground">{tenant.lease_end || "N/A"}</span>.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your account isn't linked to an active unit. Contact your property manager to check you in.
                </p>
              )}
            </div>

            {tenant && tenant.status === "Inactive" && (
              <div className="bg-red-50/70 border border-red-200/50 rounded-xl p-3 flex gap-2.5 items-start text-left">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-800 leading-normal">
                  <strong>Notice:</strong> Your dormant tenancy profile and all associated logs (leases, payments, invoices) will be permanently cleared from the database 3 months after your checkout date. Please back up any records you require for your archives.
                </p>
              </div>
            )}

            {tenant && tenant.status === "Inactive" && (
              <div className="text-left text-xs bg-card p-3 rounded-lg border border-border/60 space-y-1.5 font-sans">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tenant Name</span>
                  <span className="font-medium text-foreground">{tenant.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Move-out Date</span>
                  <span className="font-medium text-foreground">{tenant.lease_end || "—"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Deposit Settlement Card */}
          {tenant && tenant.status === "Inactive" && hasDeposits && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border bg-muted/30">
                <Wallet className="w-4.5 h-4.5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Security Deposit Settlement</h3>
              </div>

              <div className="p-4 space-y-2">
                {deposits.map((d) => (
                  <div key={d.id} className="flex justify-between items-start text-xs p-2.5 bg-muted/30 rounded-lg border border-border/40">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{d.deposit_type}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Billed: {formatKES(d.amount_billed)}</p>
                      {d.status === "Applied" && (
                        <p className="text-[10px] text-orange-600 mt-0.5 italic">Applied to settle arrears / repair costs</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`font-bold text-sm ${
                        d.status === "Applied" ? "text-orange-500" : d.status === "Refunded" ? "text-indigo-600" : "text-emerald-600"
                      }`}>
                        {formatKES(d.amount_paid)}
                      </p>
                      <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                        d.status === "Held"
                          ? "bg-emerald-100 text-emerald-800"
                          : d.status === "Refunded"
                          ? "bg-indigo-100 text-indigo-800"
                          : d.status === "Applied"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {d.status === "Applied" ? "Deducted" : d.status === "Refunded" ? "Refunded" : d.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary breakdown */}
              {hasSettlement && (
                <div className="mx-4 mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Final Statement</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Deposit Paid</span>
                    <span className="font-semibold text-foreground">{formatKES(totalPaid)}</span>
                  </div>
                  {totalApplied > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Deducted (arrears / damages)</span>
                      <span className="font-semibold text-orange-600">−{formatKES(totalApplied)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                    <span className="text-foreground">Net Amount Refunded</span>
                    <span className="text-indigo-700 text-sm">{formatKES(totalRefunded)}</span>
                  </div>
                </div>
              )}

              {/* If deposit is still Held (checkout happened without settling deposits) */}
              {!hasSettlement && deposits.every((d) => d.status === "Held") && (
                <div className="mx-4 mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-amber-800">Your deposit of <span className="font-bold">{formatKES(totalPaid)}</span> is still being processed. Contact your property agent for your refund status.</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 text-center">
            <p className="text-[11px] text-muted-foreground">
              Need past invoices or receipts? Contact your agent or landlord.
            </p>
            <Button onClick={signOut} variant="outline" className="w-full max-w-xs h-10 font-semibold text-xs rounded-xl">
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const unpaidInvoices = invoices.filter((i) => i.status === "Unpaid" || i.status === "Partially Paid");
  // Authoritative outstanding = sum of (total - verified amount_paid) per invoice
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + Math.max(0, i.total - (i.amount_paid || 0)), 0);
  // Pending payments submitted but not yet verified by agent
  const totalPending = payments.filter((p) => p.status === "Pending").reduce((s, p) => s + (p.amount || 0), 0);
  const overdueCount = unpaidInvoices.filter((i) => i.due_date && i.due_date < today).length;
  const isFullySettled = totalOutstanding <= 0;
  const firstName = tenant.full_name?.split(" ")[0] || "Tenant";
  const rentDue = tenant.monthly_rent || 0;
  const recentPayments = payments.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Habari, ${firstName} 👋`}
        subtitle={`${tenant.unit_number} · ${tenant.property_name}`}
      />
      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {!profile?.phone && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Update your phone number</p>
                <p className="text-xs text-amber-700">Required to receive notifications and receipts.</p>
              </div>
            </div>
            <Link to="/settings" className="shrink-0">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs font-semibold px-3">Update</Button>
            </Link>
          </div>
        )}

        {/* Overdue alert banner */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800">{overdueCount} overdue invoice{overdueCount > 1 ? "s" : ""}</p>
              <p className="text-xs text-orange-700">Please settle immediately to avoid penalties.</p>
            </div>
            <Link to="/tenant/payments" className="shrink-0">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white h-8 text-xs font-semibold px-3">Pay Now</Button>
            </Link>
          </div>
        )}

        {/* Balance card — driven by invoices, not raw payment totals */}
        <div className={`rounded-xl p-5 shadow-sm ${
          isFullySettled ? "bg-emerald-50 border border-emerald-200"
          : overdueCount > 0 ? "bg-orange-50 border border-orange-200"
          : "bg-amber-50 border border-amber-200"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {isFullySettled ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              : overdueCount > 0 ? <AlertCircle className="w-5 h-5 text-orange-600" />
              : <Clock className="w-5 h-5 text-amber-600" />}
            <h3 className="text-sm font-semibold">
              {isFullySettled ? "All Bills Settled" : overdueCount > 0 ? "Overdue Bills" : "Outstanding Balance"}
            </h3>
          </div>
          <p className="text-2xl font-bold tracking-tight">{formatKES(totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isFullySettled ? "No outstanding invoices 🎉" : `${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length !== 1 ? "s" : ""}`}
          </p>
          {!isFullySettled && (
            <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Monthly Rent</span>
                <span className="font-medium">{formatKES(rentDue)}</span>
              </div>
              {totalPending > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-amber-700 font-medium">Pending Verification</span>
                  <span className="font-medium text-amber-700">{formatKES(totalPending)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Still to Pay</span>
                <span className="text-foreground">{formatKES(Math.max(0, totalOutstanding - totalPending))}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={DoorOpen} label="My Unit" value={tenant.unit_number} subtitle={tenant.unit_type} color="primary" />
          <StatCard icon={TrendingUp} label="Monthly Rent" value={formatKES(rentDue)} color="blue" />
        </div>

        {/* Recent payment history with Verified / Pending status badges */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold">Payment History</h3>
            <Link to="/tenant/payments" className="text-xs text-primary font-medium">View All</Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentPayments.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${p.status === "Verified" ? "text-emerald-500" : "text-amber-400"}`} />
                      <p className="text-sm font-medium truncate">{p.month_for}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${
                        p.status === "Verified"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                          : "text-amber-700 bg-amber-50 border-amber-100"
                      }`}>
                        {p.status === "Verified" ? "Verified" : "Pending"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">
                      {p.payment_date} · {p.payment_method}{p.reference ? ` · ${p.reference}` : ""}
                    </p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ml-3 ${p.status === "Verified" ? "text-emerald-600" : "text-amber-600"}`}>
                    {formatKES(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/tenant/unit">
            <Button variant="outline" className="w-full h-12 text-sm font-medium">
              <DoorOpen className="w-4 h-4 mr-2" /> My Unit
            </Button>
          </Link>
          <Link to="/tenant/payments">
            <Button className="w-full h-12 text-sm font-medium">
              <CreditCard className="w-4 h-4 mr-2" /> Pay Bills
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
