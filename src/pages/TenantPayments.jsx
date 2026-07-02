import React, { useState, useEffect } from "react";
import { loadDemoTenant } from "@/lib/demoTenant";
import { CreditCard, Search, CheckCircle2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { generatePaymentReceiptPdf } from "@/lib/receiptPdf";

export default function TenantPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { payments: pays } = await loadDemoTenant();
        setPayments(pays);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = payments.filter((p) =>
    !search || p.month_for?.toLowerCase().includes(search.toLowerCase()) ||
    p.reference?.toLowerCase().includes(search.toLowerCase()) ||
    p.payment_method?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

  if (loading) return (<><PageHeader title="My Payments" backPath="/" /><LoadingSpinner /></>);

  return (
    <div>
      <PageHeader title="My Payments" subtitle={`KES ${totalPaid.toLocaleString()} total paid`} backPath="/" />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search payments..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments found" description={search ? "Try a different search." : "Your payment history will appear here."} />
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div key={p.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <h3 className="font-semibold text-sm">{p.month_for}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.payment_date}</p>
                    <p className="text-xs text-muted-foreground">{p.payment_method}</p>
                    {p.reference && (
                      <p className="text-[11px] text-primary mt-0.5 font-mono">{p.reference}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-bold text-emerald-600">{formatKES(p.amount)}</p>
                    <button onClick={() => generatePaymentReceiptPdf(p)} className="text-[11px] text-primary flex items-center gap-1 hover:underline">
                      <Download className="w-3 h-3" /> Receipt
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}