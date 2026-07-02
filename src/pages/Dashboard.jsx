import React, { useState, useEffect } from "react";
import { entities, auth } from "@/api/supabaseClient";
import { Link } from "react-router-dom";
import { Building2, DoorOpen, Users, CreditCard, TrendingUp, AlertCircle, LogOut } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [properties, units, tenants, payments, me] = await Promise.all([
        entities.Property.list(),
        entities.Unit.list(),
        entities.Tenant.filter({ status: "Active" }),
        entities.Payment.list("-payment_date", 5),
        auth.me(),
      ]);

      const occupied = units.filter((u) => u.status === "Occupied").length;
      const totalRent = units.reduce((s, u) => s + (u.monthly_rent || 0), 0);
      const now = new Date();
      const currentMonth = now.toLocaleString("en", { month: "long", year: "numeric" });
      const thisMonthPayments = payments.filter((p) => p.month_for === currentMonth);
      const collected = thisMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);

      setStats({
        properties: properties.length,
        totalUnits: units.length,
        occupied,
        vacant: units.length - occupied,
        tenants: tenants.length,
        totalRent,
        collected,
        outstanding: totalRent - collected,
      });
      setRecentPayments(payments);
      setUser(me);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("demo_role");
    window.location.href = "/login";
  };

  const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

  if (loading) return <LoadingSpinner />;

  const firstName = user?.full_name?.split(" ")[0] || "Landlord";

  return (
    <div>
      <PageHeader
        title={`Habari, ${firstName} 👋`}
        subtitle="ApartaBase — Property Management"
        action={
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        }
      />

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Building2} label="Properties" value={stats.properties} color="primary" />
          <StatCard icon={DoorOpen} label="Total Units" value={stats.totalUnits} subtitle={`${stats.occupied} occupied`} color="blue" />
          <StatCard icon={Users} label="Tenants" value={stats.tenants} color="success" />
          <StatCard icon={AlertCircle} label="Vacant" value={stats.vacant} color="danger" />
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">This Month</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expected Rent</span>
              <span className="font-semibold">{formatKES(stats.totalRent)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Collected</span>
              <span className="font-semibold text-emerald-600">{formatKES(stats.collected)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-semibold text-red-500">{formatKES(stats.outstanding)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: stats.totalRent ? `${Math.min((stats.collected / stats.totalRent) * 100, 100)}%` : "0%" }}
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
                    <p className="text-sm font-medium truncate">{p.tenant_name || "Tenant"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.unit_number} · {p.month_for} · {p.payment_method}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 shrink-0 ml-3">
                    {formatKES(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/properties">
            <Button variant="outline" className="w-full h-12 text-sm font-medium">
              <Building2 className="w-4 h-4 mr-2" /> Properties
            </Button>
          </Link>
          <Link to="/payments">
            <Button className="w-full h-12 text-sm font-medium">
              <CreditCard className="w-4 h-4 mr-2" /> Record Pay
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}