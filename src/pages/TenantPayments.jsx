import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { CreditCard, Search, CheckCircle2, Download, AlertCircle, Calendar, FileText, Wallet, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { generatePaymentReceiptPdf } from "@/lib/receiptPdf";
import { useToast } from "@/components/ui/use-toast";
import ReceiptReviewDialog from "@/components/invoices/ReceiptReviewDialog";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

export default function TenantPayments() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tenant, setTenant] = useState(null);
  const [property, setProperty] = useState(null);
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("bills"); // "bills" | "history"

  // Payment dialog states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [amountToPay, setAmountToPay] = useState("");
  const [mpesaRef, setMpesaRef] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [reviewReceipt, setReviewReceipt] = useState(null); // { payment, invoice, receiptNumber }

  useEffect(() => {
    if (selectedInvoice) {
      // Calculate true payable balance: total minus verified paid minus already-pending
      const pendingForInv = payments
        .filter((p) => p.invoice_number === selectedInvoice.invoice_number && p.status === "Pending")
        .reduce((s, p) => s + (p.amount || 0), 0);
      const maxPayable = selectedInvoice.total - (selectedInvoice.amount_paid || 0) - pendingForInv;
      setAmountToPay(Math.max(0, maxPayable).toString());
    } else {
      setAmountToPay("");
    }
  }, [selectedInvoice, payments]);

  useEffect(() => {
    loadTenantData();
  }, [user]);

  const loadTenantData = async () => {
    if (!user) return;
    try {
      // 1. Get active tenant association
      const { data: tenantData, error: tenantErr } = await supabase
        .from("tenants")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "Active")
        .maybeSingle();

      if (tenantErr) throw tenantErr;

      if (tenantData) {
        setTenant(tenantData);

        // 2. Fetch linked property accounts
        const { data: propData } = await supabase
          .from("properties")
          .select("*")
          .eq("id", tenantData.property_id)
          .maybeSingle();
        setProperty(propData);

        // 3. Fetch invoices, payments & receipts in parallel
        const [invRes, payRes, rctRes] = await Promise.all([
          supabase
            .from("invoices")
            .select("*")
            .eq("tenant_id", tenantData.id)
            .order("created_date", { ascending: false }),
          supabase
            .from("payments")
            .select("*")
            .eq("tenant_id", tenantData.id)
            .order("payment_date", { ascending: false }),
          supabase
            .from("receipts")
            .select("*")
        ]);

        setInvoices(invRes.data || []);
        setPayments(payRes.data || []);
        setReceipts(rctRes.data || []);
      }
    } catch (e) {
      console.error("Error loading tenant billing info:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const payAmt = parseInt(amountToPay);
    const pendingForInv = payments
      .filter((p) => p.invoice_number === selectedInvoice.invoice_number && p.status === "Pending")
      .reduce((s, p) => s + (p.amount || 0), 0);
    const maxPayable = selectedInvoice.total - (selectedInvoice.amount_paid || 0) - pendingForInv;

    if (isNaN(payAmt) || payAmt <= 0 || payAmt > maxPayable) {
      toast({ title: "Please enter a valid payment amount", variant: "destructive" });
      return;
    }

    if (!selectedInvoice || !mpesaRef.trim()) {
      toast({ title: "Please enter your M-Pesa transaction reference", variant: "destructive" });
      return;
    }

    setSubmittingPayment(true);
    try {
      const reference = mpesaRef.trim().toUpperCase();

      // 1. Create a payment receipt in 'Pending' status
      const { error: payError } = await supabase
        .from("payments")
        .insert({
          tenant_id: tenant.id,
          tenant_name: tenant.full_name,
          unit_id: selectedInvoice.unit_id,
          unit_number: selectedInvoice.unit_number,
          property_id: selectedInvoice.property_id,
          property_name: selectedInvoice.property_name,
          amount: payAmt,
          payment_date: new Date().toISOString().split("T")[0],
          payment_method: "M-Pesa",
          month_for: selectedInvoice.month_for,
          reference: reference,
          invoice_number: selectedInvoice.invoice_number || null,
          status: "Pending",
          notes: "Paid online by tenant, pending verification",
        });

      if (payError) throw payError;

      toast({
        title: "Payment submitted successfully!",
        description: `Reference ${reference} is pending verification by the agent.`,
      });
      setSelectedInvoice(null);
      setMpesaRef("");
      setLoading(true);
      await loadTenantData();
    } catch (err) {
      toast({
        title: "Payment failed",
        description: err.message || "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) return (<><PageHeader title="My Payments" backPath="/" /><LoadingSpinner /></>);

  if (!tenant) {
    return (
      <div>
        <PageHeader title="My Payments" backPath="/" />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <DoorOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-sm">No Unit Association Found</h3>
          <p className="text-xs text-muted-foreground mt-1">Check-in details are required to view bills or make payments.</p>
        </div>
      </div>
    );
  }

  // Both Unpaid and Pending Verification invoices are shown in the bills tab
  const unpaidInvoices = invoices.filter(
    (i) => i.status === "Unpaid" || i.status === "Pending Verification" || i.status === "Partially Paid"
  );
  const completedPayments = payments;

  const totalOutstanding = unpaidInvoices
    .filter((i) => i.status === "Unpaid" || i.status === "Partially Paid")
    .reduce((s, i) => s + (i.total - (i.amount_paid || 0)), 0);

  return (
    <div className="pb-24">
      <PageHeader
        title="My Payments"
        subtitle={`Outstanding: ${formatKES(totalOutstanding)}`}
        backPath="/"
      />

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("bills")}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center transition-colors ${
              activeTab === "bills"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Unpaid Bills ({unpaidInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center transition-colors ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Receipts & History ({completedPayments.length})
          </button>
        </div>

        {/* 1. Unpaid Bills Tab */}
        {activeTab === "bills" && (
          <div className="space-y-3">
            {unpaidInvoices.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All bills paid! 🎉"
                description="You have no outstanding invoices for this month."
              />
            ) : (
              unpaidInvoices.map((inv) => {
                const pendingAmt = payments
                  .filter((p) => p.invoice_number === inv.invoice_number && p.status === "Pending")
                  .reduce((s, p) => s + (p.amount || 0), 0);
                const remaining = inv.total - (inv.amount_paid || 0);
                const isFullyCovered = remaining - pendingAmt <= 0;

                // Overdue: due_date in the past and not fully paid
                const today = new Date().toISOString().split("T")[0];
                const isOverdue = inv.due_date && inv.due_date < today && inv.status !== "Paid";

                // Status badge label and styling
                const displayStatus = isOverdue
                  ? (inv.status === "Partially Paid" ? "Overdue · Partial" : "Overdue")
                  : inv.status;
                const badgeClass = isOverdue
                  ? "text-orange-700 bg-orange-50 border border-orange-200"
                  : inv.status === "Partially Paid"
                  ? "text-indigo-700 bg-indigo-50 border border-indigo-100"
                  : "text-red-700 bg-red-50";

                return (
                  <div key={inv.id} className={`bg-card rounded-xl border p-4 shadow-sm space-y-3 ${
                    isOverdue ? "border-orange-300" : "border-border"
                  }`}>

                    {/* Overdue warning banner */}
                    {isOverdue && (
                      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 -mb-1">
                        <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
                        <p className="text-xs text-orange-700 font-medium">
                          This invoice is overdue since {inv.due_date}. Please settle immediately.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between items-start border-b border-border pb-2.5">
                      <div>
                        <h3 className="font-bold text-sm">
                          {inv.month_for} Invoice {inv.invoice_number ? `(${inv.invoice_number})` : ""}
                        </h3>
                        <p className={`text-[11px] mt-0.5 ${
                          isOverdue ? "text-orange-600 font-medium" : "text-muted-foreground"
                        }`}>
                          Due date: {inv.due_date || "Not set"}{isOverdue ? " · OVERDUE" : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                        {displayStatus}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Base Monthly Rent</span>
                        <span className="font-medium text-foreground">{formatKES(inv.base_rent)}</span>
                      </div>
                      {(inv.items || []).map((it, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{it.description}</span>
                          <span className="font-medium text-foreground">{formatKES(it.amount)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-border">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase">Total: {formatKES(inv.total)}</p>
                        {inv.amount_paid > 0 && (
                          <p className="text-[10px] text-indigo-600 font-medium">Verified Paid: {formatKES(inv.amount_paid)}</p>
                        )}
                        {pendingAmt > 0 && (
                          <p className="text-[10px] text-amber-600 font-medium">Pending Verification: {formatKES(pendingAmt)}</p>
                        )}
                        <p className="text-sm font-bold text-foreground">
                          Remaining Balance: {formatKES(remaining - pendingAmt)}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        className="h-8 px-4 text-xs font-semibold" 
                        onClick={() => setSelectedInvoice(inv)}
                        disabled={isFullyCovered}
                      >
                        {isFullyCovered ? "Submitted (Pending)" : "Pay Now"}
                        {!isFullyCovered && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. Receipts & History Tab */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {completedPayments.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No payments recorded"
                description="Your past payment history and M-Pesa receipts will appear here."
              />
            ) : (
              completedPayments.map((p) => (
                <div key={p.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 ${
                          p.status === "Verified" ? "text-emerald-500" : "text-amber-500"
                        }`} />
                        <h3 className="font-semibold text-sm">{p.month_for}</h3>
                        {p.status !== "Verified" && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                            Pending Verification
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Paid on: {p.payment_date}</p>
                      <p className="text-xs text-muted-foreground">{p.payment_method}</p>
                      {p.reference && (
                        <p className="text-[11px] text-primary mt-1 font-mono bg-muted px-1.5 py-0.5 rounded w-fit">
                          REF: {p.reference}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5 ml-3">
                      <p className="text-sm font-bold text-emerald-600">{formatKES(p.amount)}</p>
                      {p.status === "Verified" ? (
                        <button
                          onClick={() => {
                            const rct = receipts.find((r) => r.payment_id === p.id);
                            const inv = invoices.find((inv) => inv.invoice_number === p.invoice_number);
                            setReviewReceipt({ payment: p, invoice: inv, receiptNumber: rct?.receipt_number });
                          }}
                          className="text-[11px] text-primary flex items-center gap-1.5 hover:underline font-semibold"
                        >
                          <Download className="w-3 h-3" /> Receipt PDF
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic bg-muted/40 px-1.5 py-0.5 rounded">
                          Receipt pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Interactive Payment Dialog */}
      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Make Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePaySubmit} className="space-y-4 pt-2">
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Invoice Total</p>
                    <p className="text-sm font-bold text-foreground">{formatKES(selectedInvoice.total)}</p>
                    {selectedInvoice.amount_paid > 0 && (
                      <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">Verified Paid: {formatKES(selectedInvoice.amount_paid)}</p>
                    )}
                    {(() => {
                      const pAmt = payments
                        .filter((p) => p.invoice_number === selectedInvoice.invoice_number && p.status === "Pending")
                        .reduce((s, p) => s + (p.amount || 0), 0);
                      return pAmt > 0 ? (
                        <p className="text-[10px] text-amber-600 font-medium mt-0.5">Pending Verification: {formatKES(pAmt)}</p>
                      ) : null;
                    })()}
                  </div>
                  <Wallet className="w-7 h-7 text-primary opacity-80" />
                </div>
                <div className="border-t border-primary/10 pt-2.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Amount to Pay (KES) *</Label>
                  <Input
                    type="number"
                    value={amountToPay}
                    onChange={(e) => setAmountToPay(e.target.value)}
                    max={selectedInvoice.total - (selectedInvoice.amount_paid || 0) - payments
                      .filter((p) => p.invoice_number === selectedInvoice.invoice_number && p.status === "Pending")
                      .reduce((s, p) => s + (p.amount || 0), 0)}
                    min={1}
                    className="mt-1 h-9 font-bold text-primary"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Max payable: {formatKES(selectedInvoice.total - (selectedInvoice.amount_paid || 0) - payments
                      .filter((p) => p.invoice_number === selectedInvoice.invoice_number && p.status === "Pending")
                      .reduce((s, p) => s + (p.amount || 0), 0))}
                  </p>
                </div>
              </div>

              {/* Payment Account Details */}
              <div className="bg-card border border-border rounded-xl p-3.5 space-y-2.5 text-xs">
                <p className="font-bold flex items-center gap-1.5 text-muted-foreground">
                  <CreditCard className="w-4 h-4" /> Property Account Details
                </p>

                {property?.paybill_number ? (
                  <div className="grid grid-cols-2 gap-1.5 border-t border-border/50 pt-2">
                    <span className="text-muted-foreground">M-Pesa Paybill</span>
                    <span className="font-semibold text-right">{property.paybill_number}</span>
                    <span className="text-muted-foreground">Account Name</span>
                    <span className="font-semibold text-right">{property.account_name || tenant.unit_number}</span>
                  </div>
                ) : property?.bank_name ? (
                  <div className="grid grid-cols-2 gap-1.5 border-t border-border/50 pt-2">
                    <span className="text-muted-foreground">Bank Name</span>
                    <span className="font-semibold text-right">{property.bank_name}</span>
                    <span className="text-muted-foreground">Account No.</span>
                    <span className="font-semibold text-right">{property.account_number}</span>
                    <span className="text-muted-foreground">Account Name</span>
                    <span className="font-semibold text-right">{property.account_name || "—"}</span>
                  </div>
                ) : (
                  <div className="flex gap-2 text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[11px]">No specific accounts configured for this property. Please send rent directly to the agent's account.</p>
                  </div>
                )}
              </div>

              {/* Transaction code verification */}
              <div className="space-y-1.5">
                <Label htmlFor="mpesa-ref" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  M-Pesa Transaction Reference *
                </Label>
                <Input
                  id="mpesa-ref"
                  placeholder="e.g. QRT89XHY67"
                  maxLength={10}
                  value={mpesaRef}
                  onChange={(e) => setMpesaRef(e.target.value)}
                  className="font-mono text-center text-sm tracking-widest uppercase h-10"
                  required
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={submittingPayment || !mpesaRef.trim()}>
                {submittingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying Payment...
                  </>
                ) : (
                  "Confirm & Submit Payment"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

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