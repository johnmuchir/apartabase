import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import { DoorOpen, Users, CreditCard, LogOut, CheckCircle2, Clock, Building2, MapPin, AlertCircle } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export default function LandlordDashboard() {
  const { signOut, profile } = useAuth();
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allMonthPayments, setAllMonthPayments] = useState([]);
  const [allMonthInvoices, setAllMonthInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const props = await entities.Property.list();
      setProperties(props);
      if (props.length > 0) {
        const allUnits = await entities.Unit.list();
        setUnits(allUnits);
        // Fetch recent 5 for display, all current-month payments & invoices for stats
        const now = new Date();
        const currentMonth = now.toLocaleString("en", { month: "long", year: "numeric" });
        const [recentPays, monthPays, monthInvs] = await Promise.all([
          entities.Payment.list("-payment_date", 5),
          entities.Payment.filter({ month_for: currentMonth }),
          entities.Invoice.filter({ month_for: currentMonth }),
        ]);
        setPayments(recentPays);
        setAllMonthPayments(monthPays);
        setAllMonthInvoices(monthInvs);
      }
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

  if (properties.length === 0) {
    return (
      <div>
        <PageHeader
          title="My Property"
          action={
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          }
        />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-base font-semibold">No property assigned</h3>
          <p className="text-sm text-muted-foreground mt-1">Contact your agent to link a property to your account.</p>
        </div>
      </div>
    );
  }

  const occupied = units.filter((u) => u.status === "Occupied").length;
  const vacant = units.length - occupied;
  const occPct = units.length ? Math.round((occupied / units.length) * 100) : 0;
  const vacPct = units.length ? 100 - occPct : 0;
  const totalRent = units.reduce((s, u) => s + (u.monthly_rent || 0), 0);
  const now = new Date();
  const currentMonth = now.toLocaleString("en", { month: "long", year: "numeric" });
  // Invoice-driven figures — prevents negative outstanding from mixed baselines
  const invoiced = allMonthInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const collected = allMonthInvoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
  const pendingAmt = allMonthPayments.filter((p) => p.status === "Pending").reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding = allMonthInvoices.reduce((s, i) =>
    i.status !== "Paid" ? s + Math.max(0, (i.total || 0) - (i.amount_paid || 0)) : s, 0
  );
  const isPaid = outstanding <= 0 && invoiced > 0;
  const balance = outstanding;

  return (
    <div>
      <PageHeader
        title="My Property"
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

        {/* Property card */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">{properties.length} {properties.length === 1 ? "Property" : "Properties"}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {properties.map((p) => p.name).join(", ")}
              </p>
            </div>
          </div>
        </div>

        {/* Rent status — simple, no charts */}
        <div className={`rounded-xl p-5 shadow-sm ${isPaid ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            {isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
            <h3 className="text-sm font-semibold">{isPaid ? "Rent Fully Collected" : "Rent Pending"}</h3>
          </div>
          <p className="text-2xl font-bold tracking-tight">{formatKES(Math.max(balance, 0))}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isPaid ? `All rent collected for ${currentMonth} 🎉` : `Outstanding for ${currentMonth}`}
          </p>
          {!isPaid && (
            <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Invoiced</span>
                <span className="font-medium">{formatKES(invoiced)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Collected (Verified)</span>
                <span className="font-medium text-emerald-600">{formatKES(collected)}</span>
              </div>
              {pendingAmt > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-amber-700 font-medium">Pending Verification</span>
                  <span className="font-medium text-amber-700">{formatKES(pendingAmt)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Simple stats — no charts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-3 text-center shadow-sm">
            <DoorOpen className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold">{units.length}</p>
            <p className="text-[10px] text-muted-foreground">Units</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center shadow-sm">
            <Users className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold">{occupied}</p>
            <p className="text-[10px] text-muted-foreground">Occupied</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center shadow-sm">
            <DoorOpen className="w-4 h-4 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-bold">{vacant}</p>
            <p className="text-[10px] text-muted-foreground">Vacant</p>
          </div>
        </div>

        {/* Occupancy breakdown */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Occupancy Breakdown</h3>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-emerald-500" style={{ width: `${occPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${vacPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Occupied</span>
              <span className="font-semibold">{occupied} ({occPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-muted-foreground">Vacant</span>
              <span className="font-semibold">{vacant} ({vacPct}%)</span>
            </div>
          </div>
        </div>

        {/* Recent payments — simple list */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold">Recent Payments</h3>
            <Link to="/payments" className="text-xs text-primary font-medium">View All</Link>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((p) => (
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
                    <p className="text-[11px] text-muted-foreground">{p.unit_number} · {p.month_for}</p>
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

        <div className="grid grid-cols-2 gap-3">
          <Link to="/properties">
            <Button variant="outline" className="w-full h-12 text-sm font-medium">
              <Building2 className="w-4 h-4 mr-2" /> Property
            </Button>
          </Link>
          <Link to="/payments">
            <Button className="w-full h-12 text-sm font-medium">
              <CreditCard className="w-4 h-4 mr-2" /> Payments
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}