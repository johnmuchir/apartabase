import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, CheckCircle2, Wallet } from "lucide-react";
import { generatePaymentReceiptPdf } from "@/lib/receiptPdf";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

export default function ReceiptReviewDialog({ open, onOpenChange, payment, invoice, receiptNumber }) {
  if (!payment) return null;

  const handleDownload = () => {
    try {
      generatePaymentReceiptPdf(payment, invoice, receiptNumber);
    } catch (e) {
      console.error("PDF generation failed:", e);
    }
  };

  const remainingBalance = invoice 
    ? Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0)) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto p-0 border-none bg-background rounded-2xl shadow-2xl">
        {/* Header decoration */}
        <div className="bg-emerald-600 px-6 py-5 rounded-t-2xl text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-100 shrink-0" />
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-semibold">
                Official Receipt
              </span>
            </div>
            <DialogTitle className="text-lg font-bold mt-1 text-white">Receipt Review</DialogTitle>
          </div>
          <FileText className="w-8 h-8 text-emerald-100 opacity-80" />
        </div>

        <div className="p-6 space-y-6">
          {/* Main Paper Receipt Card */}
          <div className="bg-card border border-border/80 rounded-xl p-5 shadow-sm space-y-4 font-sans relative overflow-hidden">
            {/* Paper cut pattern mockup at top */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-emerald-500/20" />
            
            {/* Logo/Brand Info */}
            <div className="flex justify-between items-start border-b border-border/60 pb-3">
              <div>
                <h4 className="font-bold text-base text-foreground tracking-tight">ApartaBase</h4>
                <p className="text-[10px] text-muted-foreground">Property Management Systems</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-primary font-mono">{receiptNumber || "TEMP-RCT"}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Core Details Grid */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant</span>
                <span className="font-semibold text-foreground">{payment.tenant_name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property / Unit</span>
                <span className="font-semibold text-foreground">
                  {payment.property_name || "—"} · {payment.unit_number || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Month for</span>
                <span className="font-semibold text-foreground">{payment.month_for || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="font-semibold text-foreground">{payment.payment_method || "—"}</span>
              </div>
              {payment.reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction Reference</span>
                  <span className="font-mono text-primary font-semibold">{payment.reference}</span>
                </div>
              )}
              {payment.invoice_number && (
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <span className="text-muted-foreground">Invoice Linked</span>
                  <span className="font-mono text-foreground font-semibold">{payment.invoice_number}</span>
                </div>
              )}
            </div>

            {/* Invoice Breakdown if invoice linked */}
            {invoice && (
              <div className="bg-muted/40 rounded-lg p-3 space-y-2 border border-border/30">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Invoice Total Due</span>
                  <span className="font-medium text-foreground">{formatKES(invoice.total)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount Paid Here</span>
                  <span className="font-medium text-emerald-600">{formatKES(payment.amount)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-border/40 pt-2 font-semibold">
                  <span className="text-indigo-950 dark:text-indigo-200">Remaining Balance</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{formatKES(remainingBalance)}</span>
                </div>
              </div>
            )}

            {/* Highlighted Received Amount Banner */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 text-center border border-emerald-100 dark:border-emerald-900/30">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider block">
                Total Amount Received
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {formatKES(payment.amount)}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center italic">
            This receipt serves as proof that the specified payment was received and verified.
          </p>

          {/* Action Row */}
          <div className="flex items-center gap-2.5 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11 text-xs font-semibold rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              className="flex-1 h-11 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" /> Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
