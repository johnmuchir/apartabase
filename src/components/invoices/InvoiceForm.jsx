import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
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

export default function InvoiceForm({ open, onOpenChange, units, leases, tenants, onCreated }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ unit_id: "", month_for: "", due_date: "" });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ unit_id: "", month_for: "", due_date: "" });
      setItems([]);
    }
  }, [open]);

  const selectedUnit = units.find((u) => u.id === form.unit_id);
  const lease = leases.find((l) => l.unit_id === form.unit_id);
  const tenant = tenants.find((t) => t.id === selectedUnit?.tenant_id);
  const baseRent = lease?.monthly_rent || 0;
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
      await entities.Invoice.create({
        lease_id: lease.id,
        unit_id: selectedUnit.id,
        property_id: selectedUnit.property_id,
        tenant_id: selectedUnit.tenant_id || "",
        tenant_name: tenant?.full_name || "",
        unit_number: selectedUnit.unit_number || "",
        property_name: selectedUnit.property_name || "",
        month_for: form.month_for,
        due_date: form.due_date || null,
        base_rent: baseRent,
        items: cleanItems,
        total,
        status: "Unpaid",
      });
      toast({ title: "Invoice generated!" });
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Generate Invoice</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Unit *</Label>
            <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select occupied unit" /></SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.unit_number} — {u.tenant_name || "Tenant"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {units.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">No occupied units with an active lease.</p>
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
            {saving ? "Saving..." : "Generate Invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}