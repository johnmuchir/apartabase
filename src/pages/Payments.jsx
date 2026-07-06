import React, { useState, useEffect } from "react";
import { entities, integrations, recalculateInvoiceSettlement } from "@/api/supabaseClient";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Plus, CreditCard, Search, Filter, Download, Coins, TrendingDown, ShieldCheck, Undo2, Landmark, Loader2 } from "lucide-react";
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
import ReceiptReviewDialog from "@/components/invoices/ReceiptReviewDialog";

const paymentMethods = ["M-Pesa", "Bank Transfer", "Cash", "Cheque"];
const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

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
    const { profile, demoRole } = useAuth();
    const [payments, setPayments] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [properties, setProperties] = useState([]);
    const [accountReleases, setAccountReleases] = useState([]);
    const [tenantDeposits, setTenantDeposits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState({
        tenant_id: "", amount: "", deposit_portion: "0",
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: "M-Pesa", month_for: "", reference: "", notes: "",
    });
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState("payments");
    const [reviewReceipt, setReviewReceipt] = useState(null); // { payment, invoice, receiptNumber }
    const { toast } = useToast();

    // Release accounts modal states
    const [selectedPropAccount, setSelectedPropAccount] = useState(null);
    const [releaseNotes, setReleaseNotes] = useState("");
    const [releasing, setReleasing] = useState(false);

    const isAgent = demoRole === "agent" || profile?.role === "agent";

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [p, t, inv, r, props, releasesData, depositsData] = await Promise.all([
                entities.Payment.list("-payment_date", 100),
                entities.Tenant.filter({ status: "Active" }),
                entities.Invoice.list(),
                entities.Receipt.list(),
                entities.Property.list(),
                entities.PropertyAccount.list("-created_date", 100),
                entities.TenantDeposit.list(),
            ]);
            setPayments(p || []);
            setTenants(t || []);
            setInvoices(inv || []);
            setReceipts(r || []);
            setProperties(props || []);
            setAccountReleases(releasesData || []);
            setTenantDeposits(depositsData || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        if (!form.tenant_id || !form.amount || !form.month_for || !form.payment_date) return;
        setSaving(true);
        try {
            const tenant = tenants.find((t) => t.id === form.tenant_id);
            const depositPortion = Math.min(parseInt(form.deposit_portion) || 0, parseInt(form.amount) || 0);
            const created = await entities.Payment.create({
                tenant_id: form.tenant_id,
                tenant_name: tenant?.full_name || "",
                unit_id: tenant?.unit_id || "",
                unit_number: tenant?.unit_number || "",
                property_id: tenant?.property_id || "",
                property_name: tenant?.property_name || "",
                amount: parseInt(form.amount),
                deposit_portion: depositPortion,
                payment_date: form.payment_date,
                payment_method: form.payment_method,
                month_for: form.month_for,
                reference: form.reference,
                notes: form.notes,
            });
            try { generatePaymentReceiptPdf(created); } catch (e) { /* skip */ }
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
            } catch (e) { /* skip */ }
            toast({ title: "Payment recorded — alert sent!" });
            setShowForm(false);
            setForm({
                tenant_id: "", amount: "", deposit_portion: "0",
                payment_date: new Date().toISOString().split("T")[0],
                payment_method: "M-Pesa", month_for: "", reference: "", notes: "",
            });
            setLoading(true);
            loadData();
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
        } finally { setSaving(false); }
    };

    const handleVerifyPayment = async (p) => {
        try {
            // 1. Mark this payment as Verified (agent confirms cash received)
            const { error: payErr } = await supabase
                .from("payments")
                .update({ status: "Verified", notes: "Verified by agent" })
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
            //    (determines Unpaid / Partially Paid / Paid independently)
            if (!invErr && invData) {
                await recalculateInvoiceSettlement(invData.id);
            }
            toast({ title: "Payment verified — receipt available!" });
            loadData();
        } catch (e) {
            toast({ title: "Verification failed", variant: "destructive" });
        }
    };

    const handleReleaseAccountFunds = async (e) => {
        e.preventDefault();
        if (!selectedPropAccount) return;
        setReleasing(true);
        try {
            const summary = selectedPropAccount;
            const { data: releaseData, error: releaseErr } = await supabase
                .from("property_accounts")
                .insert({
                    property_id: summary.property.id,
                    amount_gross: summary.gross,
                    amount_commission: summary.commission,
                    amount_refunds: summary.refundsTotal,
                    amount_net: summary.net,
                    notes: releaseNotes || "Funds released for property account",
                    status: "Pending"
                })
                .select()
                .single();
            if (releaseErr) throw releaseErr;
            // Link reconciled payments
            if (summary.payments.length > 0) {
                await supabase.from("payments").update({ account_release_id: releaseData.id }).in("id", summary.payments.map((p) => p.id));
            }
            // Link reconciled new deposits (Held)
            if (summary.newDeposits && summary.newDeposits.length > 0) {
                await supabase.from("tenant_deposits").update({ account_release_id: releaseData.id }).in("id", summary.newDeposits.map((d) => d.id));
            }
            // Link reconciled refunded deposits (Refunded)
            if (summary.refunds && summary.refunds.length > 0) {
                await supabase.from("tenant_deposits").update({ account_release_id: releaseData.id }).in("id", summary.refunds.map((r) => r.id));
            }
            toast({ title: "Property Account statement reconciled & released!" });
            setSelectedPropAccount(null);
            setReleaseNotes("");
            loadData();
        } catch (err) {
            toast({ title: "Failed to release property account funds", description: err.message, variant: "destructive" });
        } finally { setReleasing(false); }
    };

    const getPendingAccounts = () => {
        const summaries = [];
        properties.forEach((prop) => {
            // Verified payments for this property not yet reconciled
            const propPayments = payments.filter((p) => p.status === "Verified" && !p.account_release_id && p.property_id === prop.id);
            const gross = propPayments.reduce((s, p) => s + (p.amount || 0), 0);

            // Deposit portion is now stored directly on the payment record
            const depositsCollectedTotal = propPayments.reduce((s, p) => s + (p.deposit_portion || 0), 0);

            // Gross rent = total cash collected minus deposit portions
            const grossRentPortion = Math.max(0, gross - depositsCollectedTotal);

            // Commission calculated ONLY on the rent portion
            let commission = 0;
            if (prop.commission_type === "percentage") {
                commission = grossRentPortion * ((prop.commission_rate || 0) / 100);
            } else {
                commission = gross > 0 ? (prop.commission_rate || 0) : 0;
            }

            // Refunded deposits from tenant deposits ledger (pulled separately from rent)
            const propRefunds = tenantDeposits.filter((d) => {
                if (d.status !== "Refunded" || d.account_release_id) return false;
                const inv = invoices.find((i) => i.id === d.invoice_id);
                return inv && inv.property_id === prop.id;
            });
            const refundsTotal = propRefunds.reduce((s, r) => s + (r.amount_paid || 0), 0);

            // Net = gross cash - commission - refunds (deposits held separately, not deducted from landlord payout)
            const net = Math.max(0, gross - commission - refundsTotal);

            if (gross > 0 || refundsTotal > 0) {
                summaries.push({
                    property: prop,
                    payments: propPayments,
                    refunds: propRefunds,
                    gross,
                    grossRent: grossRentPortion,
                    depositsCollected: depositsCollectedTotal,
                    commission,
                    refundsTotal,
                    net,
                });
            }
        });
        return summaries;
    };

    const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const filtered = payments.filter((p) =>
        !search || p.tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.reference?.toLowerCase().includes(search.toLowerCase()) ||
        p.unit_number?.toLowerCase().includes(search.toLowerCase())
    );
    const selectedTenant = tenants.find((t) => t.id === form.tenant_id);
    const pendingAccounts = getPendingAccounts();

    if (loading) return (<><PageHeader title="Payments" /><LoadingSpinner /></>);

    return (
        <div>
            <PageHeader
                title="Payments"
                subtitle={`${formatKES(totalCollected)} collected`}
                action={tab === "payments" && isAgent ? (
                    <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="h-8 text-xs">
                        <Plus className="w-4 h-4 mr-1" /> Record
                    </Button>
                ) : undefined}
            />
            <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
                <div className="flex gap-2">
                    {["Payments", "Invoices", "Property Accounts"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t.toLowerCase())}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${tab === t.toLowerCase() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {tab === "payments" && (
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
                                actionLabel={isAgent ? "Record Payment" : undefined}
                                onAction={isAgent ? () => setShowForm(true) : undefined}
                            />
                        ) : (
                            <div className="space-y-2">
                                {filtered.map((p) => (
                                    <div key={p.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-sm truncate">{p.tenant_name}</h3>
                                                    {p.status !== "Verified" && (
                                                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                                                            Pending Verification
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">{p.unit_number} · {p.property_name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{p.month_for} · {p.payment_method}</p>
                                                {p.reference && <p className="text-[11px] text-primary mt-0.5 font-mono">{p.reference}</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-bold text-sm text-foreground">{formatKES(p.amount)}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">{p.payment_date}</p>
                                                <div className="flex items-center gap-1.5 mt-2 justify-end">
                                                    {p.status !== "Verified" && isAgent ? (
                                                        <Button size="sm" onClick={() => handleVerifyPayment(p)} className="h-7 text-[10px] font-bold px-2.5">Verify</Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                const matchingInv = invoices.find((inv) => inv.unit_id === p.unit_id && inv.tenant_id === p.tenant_id && inv.month_for === p.month_for);
                                                                const matchRec = receipts.find((rec) => rec.payment_id === p.id);
                                                                setReviewReceipt({ payment: p, invoice: matchingInv, receiptNumber: matchRec?.receipt_number });
                                                            }}
                                                            className="h-7 text-[10px] font-bold px-2.5 border-primary/20 text-primary hover:bg-primary/5"
                                                        >View Receipt</Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {tab === "invoices" && <InvoicesPanel />}

                {tab === "property accounts" && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Coins className="w-4.5 h-4.5 text-primary" /> Pending Property Account Statements</h3>
                            {pendingAccounts.length === 0 ? (
                                <EmptyState icon={Coins} title="No Pending Statements" description="All collected rent and refunds have been reconciled and released!" />
                            ) : (
                                pendingAccounts.map((sum) => (
                                    <div key={sum.property.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-semibold text-sm">{sum.property.name}</h4>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">Rate: {sum.property.commission_type === "percentage" ? `${sum.property.commission_rate}%` : formatKES(sum.property.commission_rate)}</p>
                                            </div>
                                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full font-mono">Net Released: {formatKES(sum.net)}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-center text-[10px] bg-muted/40 p-2.5 rounded-lg border border-border/30">
                                            <div>
                                                <span className="text-muted-foreground block text-[8px] uppercase font-bold">Total Cash</span>
                                                <span className="font-semibold text-foreground">{formatKES(sum.gross)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block text-[8px] uppercase font-bold">Gross Rent</span>
                                                <span className="font-semibold text-foreground">{formatKES(sum.grossRent)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block text-[8px] uppercase font-bold">Commission</span>
                                                <span className="font-semibold text-red-600">-{formatKES(sum.commission)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block text-[8px] uppercase font-bold">Refunds</span>
                                                <span className="font-semibold text-red-600">-{formatKES(sum.refundsTotal)}</span>
                                            </div>
                                        </div>
                                        {isAgent && (
                                            <Button onClick={() => setSelectedPropAccount(sum)} className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg">Release Account Statement</Button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="space-y-3 border-t border-border/40 pt-4">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Landmark className="w-4.5 h-4.5 text-primary" /> Account Statement History</h3>
                            {accountReleases.length === 0 ? (
                                <EmptyState icon={Landmark} title="No Released Statements" description="Account statements will appear here after releasing funds." />
                            ) : (
                                accountReleases.map((p) => {
                                    const prop = properties.find((pr) => pr.id === p.property_id);
                                    return (
                                        <div key={p.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-semibold text-xs text-foreground">{prop?.name || "Unknown Property"}</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Released on {p.release_date}</p>
                                                </div>
                                                <span className="text-xs font-bold text-foreground font-mono">{formatKES(p.amount_net)} Net</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/20">
                                                <div><span>Gross: {formatKES(p.amount_gross)}</span></div>
                                                <div><span>Comm: -{formatKES(p.amount_commission)}</span></div>
                                                <div><span>Refunds: -{formatKES(p.amount_refunds)}</span></div>
                                            </div>
                                            {p.notes && <p className="text-[11px] text-muted-foreground bg-muted/30 border border-border/30 p-2 rounded-lg italic font-sans">"{p.notes}"</p>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
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
                                    {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name} — {t.unit_number}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Total Amount Paid (KES) *</Label>
                            <Input type="number" placeholder="e.g. 25000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                            {selectedTenant?.monthly_rent > 0 && <p className="text-[11px] text-muted-foreground mt-1">Rent: KES {selectedTenant.monthly_rent.toLocaleString()}/mo</p>}
                        </div>
                        <div>
                            <Label>Deposit Portion (KES)</Label>
                            <Input
                                type="number"
                                placeholder="0 if rent only"
                                value={form.deposit_portion}
                                onChange={(e) => setForm({ ...form, deposit_portion: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Rent portion: KES {Math.max(0, (parseInt(form.amount) || 0) - (parseInt(form.deposit_portion) || 0)).toLocaleString()}
                                {" · "}
                                Commission base
                            </p>
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

            <Dialog open={!!selectedPropAccount} onOpenChange={(open) => !open && setSelectedPropAccount(null)}>
                <DialogContent className="max-w-sm mx-auto">
                    <DialogHeader><DialogTitle>Confirm Account Release</DialogTitle></DialogHeader>
                    {selectedPropAccount && (
                        <form onSubmit={handleReleaseAccountFunds} className="space-y-4 pt-2">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex gap-2.5">
                                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-emerald-900">Confirming Account Statement Release</p>
                                    <p className="text-[11px] text-emerald-700">Releasing this statement reconciles pending collections and deducts refunds and commission.</p>
                                </div>
                            </div>
                            <div className="text-xs bg-muted/40 rounded-xl p-3.5 border border-border/30 space-y-1.5 font-sans">
                                <div className="flex justify-between"><span className="text-muted-foreground">Property Name</span><span className="font-semibold text-foreground">{selectedPropAccount.property.name}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Total Cash Collected</span><span className="font-semibold text-foreground">{formatKES(selectedPropAccount.gross)}</span></div>
                                <div className="flex justify-between text-[11px] text-muted-foreground/80 pl-2"><span>— Less: Deposit Collections (Held)</span><span>-{formatKES(selectedPropAccount.depositsCollected)}</span></div>
                                <div className="flex justify-between font-medium border-t border-border/20 pt-1.5"><span className="text-muted-foreground">Gross Rent Subject to Comm.</span><span className="text-foreground">{formatKES(selectedPropAccount.grossRent)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Less: Agent Commission</span><span className="font-semibold text-red-600">-{formatKES(selectedPropAccount.commission)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Less: Refunded Deposits</span><span className="font-semibold text-red-600">-{formatKES(selectedPropAccount.refundsTotal)}</span></div>
                                <div className="flex justify-between border-t border-border/40 pt-2 font-bold text-foreground mt-2"><span>Net Statement Release</span><span className="text-emerald-700">{formatKES(selectedPropAccount.net)}</span></div>
                            </div>
                            <div>
                                <Label>Statement Release Notes</Label>
                                <Input placeholder="e.g. Bank wire ref, details..." value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} className="h-10 text-xs" />
                            </div>
                            <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={releasing}>
                                {releasing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Releasing Statement...</> : "Confirm & Release Net Funds"}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <ReceiptReviewDialog
                open={!!reviewReceipt}
                onOpenChange={(open) => !open && setReviewReceipt(null)}
                payment={reviewReceipt?.payment}
                invoice={reviewReceipt?.invoice}
                receiptNumber={reviewReceipt?.receiptNumber}
            />
        </div>
    );
}