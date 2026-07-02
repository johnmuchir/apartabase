import React, { useState, useEffect } from "react";
import { entities, auth, integrations } from "@/api/supabaseClient";
import { Plus, CreditCard, Search, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import InvoicesPanel from "@/components/invoices/InvoicesPanel";
import { useToast } from "@/components/ui/use-toast";
import { generatePaymentReceiptPdf } from "@/lib/receiptPdf";

const paymentMethods = ["M-Pesa", "Bank Transfer", "Cash", "Cheque"];

function getMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = -2; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toLocaleString("en", { month: "long", year: "numeric" }));
  }
  return months;
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    tenant_id: "", amount: "", payment_date: new Date().toISOString().split("T")[0],
    payment_method: "M-Pesa", month_for: "", reference: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("payments");
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [p, t] = await Promise.all([
        entities.Payment.list("-payment_date", 50),
        entities.Tenant.filter({ status: "Active" }),
      ]);
      setPayments(p);
      setTenants(t);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.tenant_id || !form.amount || !form.month_for || !form.payment_date) return;
    setSaving(true);
    try {
      const tenant = tenants.find((t) => t.id === form.tenant_id);
      const created = await entities.Payment.create({
        tenant_id: form.tenant_id,
        tenant_name: tenant?.full_name || "",
        unit_id: tenant?.unit_id || "",
        unit_number: tenant?.unit_number || "",
        property_id: tenant?.property_id || "",
        property_name: tenant?.property_name || "",
        amount: parseInt(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        month_for: form.month_for,
        reference: form.reference,
        notes: form.notes,
      });
      try { generatePaymentReceiptPdf(created); } catch (e) { /* pdf failure shouldn't block the payment */ }
      try {
        const me = await auth.me();
        if (me?.email) {
          await integrations.Core.SendEmail({
            to: me.email,
            from_name: "ApartaBase",
            subject: `New rent payment — KES ${parseInt(form.amount).toLocaleString()}`,
            body: `A new rent payment has been recorded.\n\nTenant: ${tenant?.full_name || "—"}\nUnit: ${tenant?.unit_number || "—"}\nProperty: ${tenant?.property_name || "—"}\nAmount: KES ${parseInt(form.amount).toLocaleString()}\nMonth: ${form.month_for}\nMethod: ${form.payment_method}\nReference: ${form.reference || "—"}\nDate: ${form.payment_date}`,
          });
        }
      } catch (e) { /* email failure shouldn't block the payment */ }
      toast({ title: "Payment recorded — alert sent!" });
      setShowForm(false);
      setForm({
        tenant_id: "", amount: "", payment_date: new Date().toISOString().split("T")[0],
        payment_method: "M-Pesa", month_for: "", reference: "", notes: "",
      });
      setLoading(true);
      loadData();
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);

  const filtered = payments.filter((p) =>
    !search || p.tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.reference?.toLowerCase().includes(search.toLowerCase()) ||
    p.unit_number?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTenant = tenants.find((t) => t.id === form.tenant_id);

  if (loading) return (<><PageHeader title="Payments" /><LoadingSpinner /></>);

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={`KES ${totalCollected.toLocaleString()} collected`}
        action={tab === "payments" ? (
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="h-8 text-xs">
            <Plus className="w-4 h-4 mr-1" /> Record
          </Button>
        ) : undefined}
      />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <div className="flex gap-2">
          {["Payments", "Invoices"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t.toLowerCase())}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                tab === t.toLowerCase() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "payments" ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search payments..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No payments recorded"
                description="Record tenant rent payments to track collection."
                actionLabel="Record Payment"
                onAction={() => setShowForm(true)}
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((p) => (
                  <div key={p.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{p.tenant_name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.unit_number} · {p.property_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.month_for} · {p.payment_method}
                        </p>
                        {p.reference && (
                          <p className="text-[11px] text-primary mt-0.5 font-mono">{p.reference}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <p className="text-sm font-bold text-emerald-600">KES {(p.amount || 0).toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">{p.payment_date}</p>
                        <button onClick={() => generatePaymentReceiptPdf(p)} className="text-[11px] text-primary flex items-center gap-1 hover:underline">
                          <Download className="w-3 h-3" /> Receipt
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <InvoicesPanel />
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Tenant *</Label>
              <Select value={form.tenant_id} onValueChange={(v) => {
                const t = tenants.find((t) => t.id === v);
                setForm({ ...form, tenant_id: v, amount: t?.monthly_rent?.toString() || form.amount });
              }}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name} — {t.unit_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (KES) *</Label>
              <Input type="number" placeholder="e.g. 25000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              {selectedTenant?.monthly_rent > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">Rent: KES {selectedTenant.monthly_rent.toLocaleString()}/mo</p>
              )}
            </div>
            <div>
              <Label>Month For *</Label>
              <Select value={form.month_for} onValueChange={(v) => setForm({ ...form, month_for: v })}>
                <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Date *</Label>
              <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / M-Pesa Code</Label>
              <Input placeholder="e.g. SHK7ABCD12" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input placeholder="Optional notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.tenant_id || !form.amount || !form.month_for} className="w-full h-12">
              {saving ? "Saving..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}