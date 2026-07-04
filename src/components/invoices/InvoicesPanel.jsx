import React, { useState, useEffect, useCallback } from "react";
import { entities, recalculateInvoiceSettlement } from "@/api/supabaseClient";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Plus, FileText, Building2, Download, Search, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import InvoiceForm from "@/components/invoices/InvoiceForm";
import { useToast } from "@/components/ui/use-toast";
import BulkInvoiceForm from "@/components/invoices/BulkInvoiceForm";
import { generatePaymentReceiptPdf } from "@/lib/receiptPdf";
import ReceiptReviewDialog from "@/components/invoices/ReceiptReviewDialog";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;
const PAGE_SIZE = 10;

// Generate list of last 24 months for month filter
function getMonthOptions() {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        opts.push(d.toLocaleString("en", { month: "long", year: "numeric" }));
    }
    return opts;
}

export default function InvoicesPanel() {
    const { profile, demoRole } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [units, setUnits] = useState([]);
    const [leases, setLeases] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [payments, setPayments] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [showForm, setShowForm] = useState(false);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [invoiceToEdit, setInvoiceToEdit] = useState(null);
    const [reviewReceipt, setReviewReceipt] = useState(null); // { payment, invoice, receiptNumber }
    const { toast } = useToast();

    // Filters
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterMonth, setFilterMonth] = useState("");
    const [filterProperty, setFilterProperty] = useState("");
    const [page, setPage] = useState(0);

    const isAgent = demoRole === "agent" || profile?.role === "agent";
    const today = new Date().toISOString().split("T")[0];
    const monthOptions = getMonthOptions();
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // ── Server-side filtered + paginated invoice fetch ──────────────────────
    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase.from("invoices").select("*", { count: "exact" });

            // Status filter (overdue is a UI concept — map to DB statuses)
            if (filterStatus === "Overdue") {
                q = q.in("status", ["Unpaid", "Partially Paid"]).lt("due_date", today);
            } else if (filterStatus !== "all") {
                q = q.eq("status", filterStatus);
            }

            // Month filter
            if (filterMonth) q = q.eq("month_for", filterMonth);

            // Property filter
            if (filterProperty) q = q.eq("property_id", filterProperty);

            // Tenant name / unit number search (ilike)
            if (search.trim()) {
                const s = `%${search.trim()}%`;
                q = q.or(`tenant_name.ilike.${s},unit_number.ilike.${s},invoice_number.ilike.${s}`);
            }

            // Sort: newest first
            q = q.order("created_date", { ascending: false });

            // Pagination
            const from = page * PAGE_SIZE;
            q = q.range(from, from + PAGE_SIZE - 1);

            const { data, error, count } = await q;
            if (error) throw error;

            setInvoices(data || []);
            setTotalCount(count || 0);

            // Fetch related payments for visible invoices (by invoice_number)
            const invoiceNumbers = (data || []).map((i) => i.invoice_number).filter(Boolean);
            if (invoiceNumbers.length > 0) {
                const { data: pays } = await supabase
                    .from("payments")
                    .select("*")
                    .in("invoice_number", invoiceNumbers)
                    .order("payment_date", { ascending: false });
                setPayments(pays || []);

                const paymentIds = (pays || []).map((p) => p.id);
                if (paymentIds.length > 0) {
                    const { data: rcts } = await supabase
                        .from("receipts")
                        .select("*")
                        .in("payment_id", paymentIds);
                    setReceipts(rcts || []);
                } else {
                    setReceipts([]);
                }
            } else {
                setPayments([]);
                setReceipts([]);
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Failed to load invoices", description: e.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [search, filterStatus, filterMonth, filterProperty, page, today]);

    // Load support data once
    useEffect(() => {
        (async () => {
            try {
                const [uts, lses, tens, props] = await Promise.all([
                    entities.Unit.list(),
                    entities.Lease.list(),
                    entities.Tenant.filter({ status: "Active" }),
                    entities.Property.list(),
                ]);
                setUnits(uts);
                setLeases(lses);
                setTenants(tens);
                setProperties(props);
            } catch (e) { console.error(e); }
        })();
    }, []);

    // Re-fetch invoices whenever any filter or page changes
    useEffect(() => { loadInvoices(); }, [loadInvoices]);

    // Reset to page 0 when filters change (not page itself)
    const applyFilter = (setter) => (val) => { setter(val); setPage(0); };

    const billableUnits = units.filter(
        (u) => u.status === "Occupied" && u.tenant_id && leases.some((l) => l.unit_id === u.id)
    );

    const handleMarkPaid = async (inv, specPayment) => {
        try {
            if (!specPayment) {
                const remaining = inv.total - (inv.amount_paid || 0);
                const val = window.prompt(`Enter cash amount received for ${inv.month_for} (max KES ${remaining}):`, remaining.toString());
                if (val === null) return;
                const num = parseInt(val);
                if (isNaN(num) || num <= 0 || num > remaining) {
                    toast({ title: "Invalid amount entered", variant: "destructive" });
                    return;
                }
                await entities.Payment.create({
                    tenant_id: inv.tenant_id || "",
                    tenant_name: inv.tenant_name || "",
                    unit_id: inv.unit_id,
                    unit_number: inv.unit_number || "",
                    property_id: inv.property_id,
                    property_name: inv.property_name || "",
                    amount: num,
                    payment_date: new Date().toISOString().split("T")[0],
                    payment_method: "Cash",
                    month_for: inv.month_for,
                    reference: `CSH-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                    invoice_number: inv.invoice_number || null,
                    status: "Verified",
                    notes: "Manual cash payment received",
                });
            } else {
                const { error: payErr } = await supabase
                    .from("payments")
                    .update({ status: "Verified", notes: "Verified by agent" })
                    .eq("id", specPayment.id);
                if (payErr) throw payErr;
            }
            await recalculateInvoiceSettlement(inv.id);
            toast({ title: "Payment verified — receipt available!" });
            loadInvoices();
        } catch (e) {
            toast({ title: "Error during verification", description: e.message, variant: "destructive" });
        }
    };

    const hasActiveFilters = filterStatus !== "all" || filterMonth || filterProperty || search;

    const clearFilters = () => {
        setSearch("");
        setFilterStatus("all");
        setFilterMonth("");
        setFilterProperty("");
        setPage(0);
    };

    return (
        <div className="space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    {totalCount} invoice{totalCount !== 1 ? "s" : ""}
                    {hasActiveFilters ? " (filtered)" : ""}
                </p>
                {isAgent && (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowBulkForm(true)} className="h-8 text-xs">
                            <Building2 className="w-3.5 h-3.5 mr-1" /> All Units
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="h-8 text-xs">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Generate
                        </Button>
                    </div>
                )}
            </div>

            {/* Filter bar */}
            <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search tenant, unit, invoice #..."
                            value={search}
                            onChange={(e) => applyFilter(setSearch)(e.target.value)}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>
                    {hasActiveFilters && (
                        <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 px-2 text-xs text-muted-foreground">
                            <X className="w-3.5 h-3.5 mr-1" /> Clear
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {/* Status filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => applyFilter(setFilterStatus)(e.target.value)}
                        className="h-8 text-xs rounded-lg border border-border bg-background px-2 text-foreground"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Paid">Paid</option>
                        <option value="Overdue">Overdue</option>
                    </select>

                    {/* Month filter */}
                    <select
                        value={filterMonth}
                        onChange={(e) => applyFilter(setFilterMonth)(e.target.value)}
                        className="h-8 text-xs rounded-lg border border-border bg-background px-2 text-foreground"
                    >
                        <option value="">All Months</option>
                        {monthOptions.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>

                    {/* Property filter */}
                    <select
                        value={filterProperty}
                        onChange={(e) => applyFilter(setFilterProperty)(e.target.value)}
                        className="h-8 text-xs rounded-lg border border-border bg-background px-2 text-foreground"
                    >
                        <option value="">All Properties</option>
                        {properties.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Invoice list */}
            {loading ? (
                <LoadingSpinner />
            ) : invoices.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title={hasActiveFilters ? "No invoices match your filters" : "No invoices yet"}
                    description={hasActiveFilters ? "Try adjusting the filters above." : "Generate a monthly invoice from a lease with optional items."}
                    actionLabel={isAgent && !hasActiveFilters ? "Generate Invoice" : hasActiveFilters ? "Clear Filters" : undefined}
                    onAction={isAgent && !hasActiveFilters ? () => setShowForm(true) : hasActiveFilters ? clearFilters : undefined}
                />
            ) : (
                <div className="space-y-2">
                    {invoices.map((inv) => {
                        const invPayments = payments.filter((p) => p.invoice_number === inv.invoice_number);
                        const remaining = inv.total - (inv.amount_paid || 0);
                        const isOverdue = inv.due_date && inv.due_date < today && inv.status !== "Paid";

                        const displayStatus = isOverdue
                            ? (inv.status === "Partially Paid" ? "Overdue · Partial" : "Overdue")
                            : inv.status;
                        const badgeClass = inv.status === "Paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : isOverdue
                            ? "bg-orange-100 text-orange-700 border border-orange-200"
                            : inv.status === "Partially Paid"
                            ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                            : "bg-red-100 text-red-700";

                        return (
                            <div key={inv.id} className={`bg-card rounded-xl border p-4 shadow-sm space-y-3 ${isOverdue ? "border-orange-300" : "border-border"}`}>
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-sm">
                                                {inv.month_for} {inv.invoice_number ? `(${inv.invoice_number})` : ""}
                                            </h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
                                                {displayStatus}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {inv.unit_number} · {inv.property_name} · {inv.tenant_name}
                                        </p>
                                        {inv.due_date && (
                                            <p className={`text-[10px] mt-0.5 font-medium ${isOverdue ? "text-orange-600" : "text-muted-foreground"}`}>
                                                Due: {inv.due_date}{isOverdue ? " · OVERDUE" : ""}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold">{formatKES(inv.total)}</p>
                                        {inv.amount_paid > 0 && (
                                            <p className="text-[9px] text-muted-foreground mt-0.5 font-medium">Paid: {formatKES(inv.amount_paid)}</p>
                                        )}
                                        {invPayments.filter((p) => p.status === "Pending").length > 0 && (
                                            <p className="text-[9px] text-amber-600 font-medium mt-0.5">
                                                Pending: {formatKES(invPayments.filter((p) => p.status === "Pending").reduce((s, p) => s + (p.amount || 0), 0))}
                                            </p>
                                        )}
                                        {remaining > 0 && (
                                            <p className="text-[9px] text-indigo-600 font-semibold mt-0.5">
                                                Balance: {formatKES(remaining - invPayments.filter((p) => p.status === "Pending").reduce((s, p) => s + (p.amount || 0), 0))}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-border space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Base Rent</span>
                                        <span>{formatKES(inv.base_rent)}</span>
                                    </div>
                                    {(inv.items || []).map((it, idx) => (
                                        <div key={idx} className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">{it.description}</span>
                                            <span>{formatKES(it.amount)}</span>
                                        </div>
                                    ))}
                                </div>

                                {invPayments.length > 0 && (
                                    <div className="bg-muted/35 p-2.5 rounded-xl border border-border/50 space-y-2 mt-2">
                                        <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                            Transactions & Receipts ({invPayments.length})
                                        </h4>
                                        <div className="space-y-1.5 divide-y divide-border/40">
                                            {invPayments.map((p, pIdx) => (
                                                <div key={p.id} className={`flex justify-between items-center text-xs ${pIdx > 0 ? "pt-1.5" : ""}`}>
                                                    <div className="min-w-0">
                                                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded font-semibold text-primary">
                                                            {p.reference || "Manual"}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground ml-2">{p.payment_date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="font-bold text-foreground">{formatKES(p.amount)}</span>
                                                        {p.status === "Verified" ? (
                                                            <button
                                                                onClick={() => {
                                                                    const rct = receipts.find((r) => r.payment_id === p.id);
                                                                    setReviewReceipt({ payment: p, invoice: inv, receiptNumber: rct?.receipt_number });
                                                                }}
                                                                className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-0.5"
                                                            >
                                                                <Download className="w-3 h-3" /> PDF
                                                            </button>
                                                        ) : isAgent ? (
                                                            <Button size="sm" className="h-6 text-[9px] px-2 font-bold" variant="secondary" onClick={() => handleMarkPaid(inv, p)}>
                                                                Verify
                                                            </Button>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground italic">Pending</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {remaining > 0 && isAgent && (
                                    <div className="flex gap-2 pt-1">
                                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-semibold" onClick={() => setInvoiceToEdit(inv)}>
                                            Edit Items
                                        </Button>
                                        <Button size="sm" className="flex-1 h-8 text-xs font-semibold" onClick={() => handleMarkPaid(inv)}>
                                            Record Cash Payment
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                        Page {page + 1} of {totalPages} · {totalCount} total
                    </p>
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm" variant="outline"
                            className="h-7 w-7 p-0"
                            disabled={page === 0}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        {/* Page number pills */}
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                            return (
                                <Button
                                    key={pg} size="sm"
                                    variant={pg === page ? "default" : "outline"}
                                    className="h-7 w-7 p-0 text-xs"
                                    onClick={() => setPage(pg)}
                                >
                                    {pg + 1}
                                </Button>
                            );
                        })}
                        <Button
                            size="sm" variant="outline"
                            className="h-7 w-7 p-0"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            <InvoiceForm
                open={showForm || !!invoiceToEdit}
                onOpenChange={(open) => {
                    if (!open) { setShowForm(false); setInvoiceToEdit(null); }
                    else { setShowForm(true); }
                }}
                units={billableUnits}
                leases={leases}
                tenants={tenants}
                onCreated={loadInvoices}
                invoiceToEdit={invoiceToEdit}
            />

            <BulkInvoiceForm
                open={showBulkForm}
                onOpenChange={setShowBulkForm}
                units={units}
                leases={leases}
                tenants={tenants}
                onCreated={loadInvoices}
            />

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
