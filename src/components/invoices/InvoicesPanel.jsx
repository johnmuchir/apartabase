import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { Plus, FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import InvoiceForm from "@/components/invoices/InvoiceForm";
import { useToast } from "@/components/ui/use-toast";
import BulkInvoiceForm from "@/components/invoices/BulkInvoiceForm";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

export default function InvoicesPanel() {
  const [invoices, setInvoices] = useState([]);
  const [units, setUnits] = useState([]);
  const [leases, setLeases] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      const [inv, uts, lses, tens] = await Promise.all([
        entities.Invoice.list("-created_date", 50),
        entities.Unit.list(),
        entities.Lease.list(),
        entities.Tenant.filter({ status: "Active" }),
      ]);
      setInvoices(inv);
      setUnits(uts);
      setLeases(lses);
      setTenants(tens);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const billableUnits = units.filter((u) => u.status === "Occupied" && u.tenant_id && leases.some((l) => l.unit_id === u.id));

  const handleMarkPaid = async (inv) => {
    try {
      await entities.Invoice.update(inv.id, { status: "Paid" });
      await entities.Payment.create({
        tenant_id: inv.tenant_id || "",
        tenant_name: inv.tenant_name || "",
        unit_id: inv.unit_id,
        unit_number: inv.unit_number || "",
        property_id: inv.property_id,
        property_name: inv.property_name || "",
        amount: inv.total,
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: "M-Pesa",
        month_for: inv.month_for,
        reference: `INV-${(inv.id || "").slice(-6).toUpperCase()}`,
        notes: "Paid via invoice",
      });
      toast({ title: "Invoice marked paid" });
      loadData();
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoices · {invoices.filter((i) => i.status === "Unpaid").length} unpaid
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowBulkForm(true)} className="h-8 text-xs">
            <Building2 className="w-4 h-4 mr-1" /> All Units
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="h-8 text-xs">
            <Plus className="w-4 h-4 mr-1" /> Generate
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Generate a monthly invoice from a lease with optional items like water or garbage."
          actionLabel="Generate Invoice"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{inv.month_for}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inv.unit_number} · {inv.property_name} · {inv.tenant_name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatKES(inv.total)}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border space-y-1">
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
              {inv.status === "Unpaid" && (
                <Button size="sm" className="w-full h-8 mt-3 text-xs" onClick={() => handleMarkPaid(inv)}>
                  Mark as Paid
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <InvoiceForm
        open={showForm}
        onOpenChange={setShowForm}
        units={billableUnits}
        leases={leases}
        tenants={tenants}
        onCreated={loadData}
      />

      <BulkInvoiceForm
        open={showBulkForm}
        onOpenChange={setShowBulkForm}
        units={units}
        leases={leases}
        tenants={tenants}
        onCreated={loadData}
      />
    </div>
  );
}