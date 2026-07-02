import React, { useState, useEffect } from "react";
import { loadDemoTenant } from "@/lib/demoTenant";
import { Link } from "react-router-dom";
import { DoorOpen, CreditCard, CheckCircle2, Clock, LogOut, TrendingUp } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import StatCard from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";

export default function TenantDashboard() {
  const [tenant, setTenant] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { tenant: t, payments: pays } = await loadDemoTenant();
      if (t) {
        setTenant(t);
        setPayments(pays);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem("demo_role");
    window.location.href = "/login";
  };

  if (loading) return (<><PageHeader title="Loading..." /><LoadingSpinner /></>);
  if (!tenant) {
    return (
      <div>
        <PageHeader title="ApartaBase" action={
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10"><LogOut className="w-5 h-5" /></button>
        } />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <DoorOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-base font-semibold">No tenant profile found</h3>
          <p className="text-sm text-muted-foreground mt-1">Your account isn't linked to a tenant record yet. Contact your landlord.</p>
          <Button onClick={handleLogout} variant="outline" className="mt-5">Log out</Button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const currentMonth = now.toLocaleString("en", { month: "long", year: "numeric" });
  const monthPayments = payments.filter((p) => p.month_for === currentMonth);
  const paidThisMonth = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const rentDue = tenant.monthly_rent || 0;
  const balance = rentDue - paidThisMonth;
  const isPaid = balance <= 0;

  const firstName = tenant.full_name?.split(" ")[0] || "Tenant";
  const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

  return (
    <div>
      <PageHeader
        title={`Habari, ${firstName} 👋`}
        subtitle={`${tenant.unit_number} · ${tenant.property_name}`}
        action={
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        }
      />

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Rent status card */}
        <div className={`rounded-xl p-5 shadow-sm ${isPaid ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
          <div className="flex items-center gap-2 mb-3">
            {isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
            <h3 className="text-sm font-semibold">{isPaid ? "Rent Paid" : "Rent Due"}</h3>
          </div>
          <p className="text-2xl font-bold tracking-tight">{formatKES(Math.max(balance, 0))}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isPaid ? `All settled for ${currentMonth} 🎉` : `Outstanding for ${currentMonth}`}
          </p>
          {!isPaid && (
            <div className="mt-3 pt-3 border-t border-amber-200">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Monthly Rent</span>
                <span className="font-medium">{formatKES(rentDue)}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-muted-foreground">Paid So Far</span>
                <span className="font-medium text-emerald-600">{formatKES(paidThisMonth)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={DoorOpen} label="My Unit" value={tenant.unit_number} subtitle={tenant.unit_type} color="primary" />
          <StatCard icon={TrendingUp} label="Monthly Rent" value={formatKES(rentDue)} color="blue" />
        </div>

        {/* Recent payments */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold">Payment History</h3>
            <Link to="/tenant/payments" className="text-xs text-primary font-medium">View All</Link>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {payments.slice(0, 5).map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.month_for}</p>
                    <p className="text-[11px] text-muted-foreground">{p.payment_date} · {p.payment_method}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 shrink-0 ml-3">{formatKES(p.amount)}</span>
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
              <CreditCard className="w-4 h-4 mr-2" /> Payments
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}