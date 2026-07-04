import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import { Building2, DoorOpen, Users, CreditCard, TrendingUp, AlertCircle, LogOut, Wallet, BarChart3, Mail } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import PropertyOccupancyChart from "@/components/charts/PropertyOccupancyChart";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export default function AgentDashboard() {
  const { signOut, profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [propertyStats, setPropertyStats] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [pendingVerifyCount, setPendingVerifyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [properties, units, tenants, payments] = await Promise.all([
        entities.Property.list(),
        entities.Unit.list(),
        entities.Tenant.filter({ status: "Active" }),
        entities.Payment.list("-payment_date", 5),
      ]);

      const occupied = units.filter((u) => u.status === "Occupied").length;
      const now = new Date();
      const currentMonth = now.toLocaleString("en", { month: "long", year: "numeric" });

      // Use invoices as the single source of truth for collection figures
      const [allPayments, monthInvoices] = await Promise.all([
        entities.Payment.filter({ month_for: currentMonth }),
        entities.Invoice.filter({ month_for: currentMonth }),
      ]);

      // Invoiced = total billed to tenants this month
      const invoiced = monthInvoices.reduce((s, i) => s + (i.total || 0), 0);
      // Collected = sum of verified amounts on invoices (from recalculated amount_paid)
      const collected = monthInvoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
      // Pending = submitted but not yet verified
      const pending = allPayments.filter((p) => p.status === "Pending").reduce((s, p) => s + (p.amount || 0), 0);
      // Outstanding = what's still owed (not yet verified)
      const outstanding = monthInvoices.reduce((s, i) =>
        i.status !== "Paid" ? s + Math.max(0, (i.total || 0) - (i.amount_paid || 0)) : s, 0
      );

      const propStats = properties.map((prop) => {
        const propUnits = units.filter((u) => u.property_id === prop.id);
        const occ = propUnits.filter((u) => u.status === "Occupied").length;
        return { name: prop.name, occupied: occ, vacant: propUnits.length - occ };
      });
      setPropertyStats(propStats);

      setStats({
        properties: properties.length,
        totalUnits: units.length,
        occupied,
        vacant: units.length - occupied,
        tenants: tenants.length,
        invoiced,
        collected,
        pending,
        outstanding,
      });
      setRecentPayments(payments);

      // Fetch all payments needing verification across all properties
      const pendingVerify = await entities.Payment.filter({ status: "Pending" });
      setPendingVerifyCount(pendingVerify.length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut();
  };

  const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Agent Overview"
        subtitle="Managing all landlord properties"
        action={
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        }
      />

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {!profile?.phone && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Update your phone number</p>
                <p className="text-xs text-amber-700">A phone number is required to receive notifications and receipts.</p>
              </div>
            </div>
            <Link to="/settings" className="shrink-0">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs font-semibold px-3">
                Update
              </Button>
            </Link>
          </div>
        )}
        
        {pendingVerifyCount > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-900 font-semibold">Verify Pending Payments</p>
                <p className="text-xs text-indigo-700">There {pendingVerifyCount === 1 ? 'is 1 payment' : `are ${pendingVerifyCount} payments`} needing agent verification.</p>
              </div>
            </div>
            <Link to="/payments" className="shrink-0">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs font-semibold px-3">
                Verify
              </Button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Building2} label="Properties" value={stats.properties} color="primary" />
          <StatCard icon={DoorOpen} label="Total Units" value={stats.totalUnits} subtitle={`${stats.occupied} occupied`} color="blue" />
          <StatCard icon={Users} label="Tenants" value={stats.tenants} color="success" />
          <StatCard icon={AlertCircle} label="Vacant" value={stats.vacant} color="danger" />
        </div>

        {propertyStats.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Occupancy by Property</h3>
            </div>
            <PropertyOccupancyChart data={propertyStats} />
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Collection This Month</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Invoiced</span>
              <span className="font-semibold">{formatKES(stats.invoiced)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Collected (Verified)</span>
              <span className="font-semibold text-emerald-600">{formatKES(stats.collected)}</span>
            </div>
            {stats.pending > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Verification</span>
                <span className="font-semibold text-amber-600">{formatKES(stats.pending)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-semibold text-red-500">{formatKES(stats.outstanding)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: stats.invoiced ? `${Math.min((stats.collected / stats.invoiced) * 100, 100)}%` : "0%" }}
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold">Recent Payments</h3>
            <Link to="/payments" className="text-xs text-primary font-medium">View All</Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentPayments.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{p.tenant_name || "Tenant"}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${
                        p.status === "Verified"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                          : "text-amber-700 bg-amber-50 border-amber-100"
                      }`}>
                        {p.status === "Verified" ? "Verified" : "Pending"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {p.property_name} · {p.unit_number} · {p.month_for}
                    </p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ml-3 ${
                    p.status === "Verified" ? "text-emerald-600" : "text-amber-600"
                  }`}>
                    {formatKES(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Link to="/properties">
            <Button variant="outline" className="w-full h-12 text-xs font-medium px-2">
              <Building2 className="w-3.5 h-3.5 mr-1" /> Properties
            </Button>
          </Link>
          <Link to="/payments">
            <Button className="w-full h-12 text-xs font-medium px-2">
              <CreditCard className="w-3.5 h-3.5 mr-1" /> Record Pay
            </Button>
          </Link>
          <Link to="/invitations">
            <Button variant="secondary" className="w-full h-12 text-xs font-medium px-2">
              <Mail className="w-3.5 h-3.5 mr-1" /> Invites
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}