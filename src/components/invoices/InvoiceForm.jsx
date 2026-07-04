import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function getMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = -2; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toLocaleString("en", { month: "long", year: "numeric" }));
  }
  return months;
}

const quickItems = ["Water", "Garbage", "Electricity"];

export default function InvoiceForm({ open, onOpenChange, units, leases, tenants, onCreated, invoiceToEdit }) {
  const { toast } = useToast();
  const currentMonth = new Date().toLocaleString("en", { month: "long", year: "numeric" });
  const [form, setForm] = useState({ unit_id: "", month_for: currentMonth, due_date: "" });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (invoiceToEdit) {
        setForm({
          unit_id: invoiceToEdit.unit_id,
          month_for: invoiceToEdit.month_for,
          due_date: invoiceToEdit.due_date || "",
        });
        setItems(
          (invoiceToEdit.items || []).map((it) => ({
            description: it.description,
            amount: it.amount.toString(),
          }))
        );
      } else {
        setForm({ unit_id: "", month_for: currentMonth, due_date: "" });
        setItems([]);
      }
    }
  }, [open, invoiceToEdit]);

  const selectedUnit = units.find((u) => u.id === form.unit_id) || (invoiceToEdit ? {
    id: invoiceToEdit.unit_id,
    unit_number: invoiceToEdit.unit_number,
    tenant_name: invoiceToEdit.tenant_name,
    property_id: invoiceToEdit.property_id,
    property_name: invoiceToEdit.property_name,
    tenant_id: invoiceToEdit.tenant_id
  } : null);

  const lease = leases.find((l) => l.unit_id === form.unit_id) || (invoiceToEdit ? {
    id: invoiceToEdit.lease_id,
    monthly_rent: invoiceToEdit.base_rent
  } : null);

  const tenant = tenants.find((t) => t.id === selectedUnit?.tenant_id);
  const baseRent = invoiceToEdit ? invoiceToEdit.base_rent : (lease?.monthly_rent || 0);

  useEffect(() => {
    if (form.unit_id && lease && !invoiceToEdit) {
      checkIfFirstInvoice();
    }
  }, [form.unit_id, lease, invoiceToEdit]);

  const checkIfFirstInvoice = async () => {
    try {
      const { count, error } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("lease_id", lease.id);

      if (!error) {
        if (count === 0 && lease.deposit > 0) {
          setItems((prev) => {
            const hasDeposit = prev.some(it => it.description.toLowerCase().includes("deposit"));
            if (!hasDeposit) {
              return [...prev, { description: "Security Deposit", amount: lease.deposit.toString() }];
            }
            return prev;
          });
        } else {
          setItems((prev) => prev.filter(it => it.description !== "Security Deposit"));
        }
      }
    } catch (e) {
      console.error("Error checking invoice history:", e);
    }
  };

  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const total = baseRent + itemsTotal;

  const addQuickItem = (desc) => setItems((prev) => [...prev, { description: desc, amount: "" }]);
  const addItem = () => setItems((prev) => [...prev, { description: "", amount: "" }]);
  const updateItem = (idx, field, val) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it)));
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.unit_id || !form.month_for || !lease) return;
    setSaving(true);
    try {
      const cleanItems = items
        .filter((i) => i.description.trim() && (parseFloat(i.amount) || 0) > 0)
        .map((i) => ({ description: i.description.trim(), amount: parseFloat(i.amount) }));

      const payload = {
        lease_id: lease.id,
        unit_id: selectedUnit.id,
        property_id: selectedUnit.property_id,
        tenant_id: selectedUnit.tenant_id || "",
        tenant_name: tenant?.full_name || selectedUnit?.tenant_name || "",
        unit_number: selectedUnit.unit_number || "",
        property_name: selectedUnit.property_name || "",
        month_for: form.month_for,
        due_date: form.due_date || null,
        base_rent: baseRent,
        items: cleanItems,
        total,
      };

      if (invoiceToEdit) {
        const amtPaid = invoiceToEdit.amount_paid || 0;
        const newStatus = amtPaid >= total 
          ? "Paid" 
          : amtPaid > 0 
          ? "Partially Paid" 
          : invoiceToEdit.status;

        await entities.Invoice.update(invoiceToEdit.id, {
          ...payload,
          status: newStatus
        });
        toast({ title: "Invoice updated successfully!" });
      } else {
        await entities.Invoice.create({
          ...payload,
          status: "Unpaid",
          amount_paid: 0
        });
        toast({ title: "Invoice generated successfully!" });
      }
      
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast({ title: "Error", description: e.message || "Failed to save invoice", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoiceToEdit ? "Edit Invoice" : "Generate Invoice"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Unit *</Label>
            <Select disabled={!!invoiceToEdit} value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select occupied unit" /></SelectTrigger>
              <SelectContent>
                {invoiceToEdit ? (
                  <SelectItem value={invoiceToEdit.unit_id}>
                    {invoiceToEdit.unit_number} — {invoiceToEdit.tenant_name || "Tenant"}
                  </SelectItem>
                ) : (
                  units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.unit_number} — {u.tenant_name || "Tenant"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Month For *</Label>
            <Select disabled={!!invoiceToEdit} value={form.month_for} onValueChange={(v) => setForm({ ...form, month_for: v })}>
              <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
              <SelectContent>
                {invoiceToEdit ? (
                  <SelectItem value={invoiceToEdit.month_for}>{invoiceToEdit.month_for}</SelectItem>
                ) : (
                  getMonthOptions().map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Due Date</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>

          {form.unit_id && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Base Rent (from lease)</span>
                <span className="font-semibold">KES {baseRent.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div>
            <Label>Additional Items</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickItems.map((q) => (
                <button key={q} type="button" onClick={() => addQuickItem(q)} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-secondary">
                  + {q}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input placeholder="Description" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="flex-1 h-8 text-xs" />
                  <Input type="number" placeholder="Amount" value={it.amount} onChange={(e) => updateItem(idx, "amount", e.target.value)} className="w-24 h-8 text-xs" />
                  <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="text-xs text-primary hover:underline mt-2 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add custom item
            </button>
          </div>

          {form.unit_id && (
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold">KES {total.toLocaleString()}</span>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={saving || !form.unit_id || !form.month_for} className="w-full h-12">
            {saving ? "Saving..." : invoiceToEdit ? "Update Invoice" : "Generate Invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}