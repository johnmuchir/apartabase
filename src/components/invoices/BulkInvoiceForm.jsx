import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

function getMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = -2; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toLocaleString("en", { month: "long", year: "numeric" }));
  }
  return months;
}

export default function BulkInvoiceForm({ open, onOpenChange, units, leases, tenants, onCreated }) {
  const { toast } = useToast();
  const [monthFor, setMonthFor] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [generating, setGenerating] = useState(false);

  // Filter units that are Occupied, have a tenant, and have an active lease
  const billableUnits = units.filter(
    (u) => u.status === "Occupied" && u.tenant_id && leases.some((l) => l.unit_id === u.id)
  );

  useEffect(() => {
    if (open) {
      setMonthFor("");
      setDueDate("");
      setSelectedUnitIds(new Set(billableUnits.map((u) => u.id)));
    }
  }, [open, units, leases]);

  const toggleUnit = (unitId) => {
    const next = new Set(selectedUnitIds);
    if (next.has(unitId)) {
      next.delete(unitId);
    } else {
      next.add(unitId);
    }
    setSelectedUnitIds(next);
  };

  const toggleAll = () => {
    if (selectedUnitIds.size === billableUnits.length) {
      setSelectedUnitIds(new Set());
    } else {
      setSelectedUnitIds(new Set(billableUnits.map((u) => u.id)));
    }
  };

  const handleGenerate = async () => {
    if (!monthFor || selectedUnitIds.size === 0) return;
    setGenerating(true);

    let successCount = 0;
    let failCount = 0;

    try {
      for (const unitId of selectedUnitIds) {
        const u = billableUnits.find((unit) => unit.id === unitId);
        const l = leases.find((lease) => lease.unit_id === unitId);
        const t = tenants.find((tenant) => tenant.id === u.tenant_id);

        if (u && l) {
          try {
            await entities.Invoice.create({
              lease_id: l.id,
              unit_id: u.id,
              property_id: u.property_id,
              tenant_id: u.tenant_id || "",
              tenant_name: t?.full_name || "",
              unit_number: u.unit_number || "",
              property_name: u.property_name || "",
              month_for: monthFor,
              due_date: dueDate || null,
              base_rent: l.monthly_rent || u.monthly_rent || 0,
              items: [],
              total: l.monthly_rent || u.monthly_rent || 0,
              status: "Unpaid",
            });
            successCount++;
          } catch (e) {
            console.error("Failed to generate bulk invoice for unit:", u.unit_number, e);
            failCount++;
          }
        }
      }

      toast({
        title: "Bulk Invoicing Complete",
        description: `Generated ${successCount} invoices successfully.${
          failCount > 0 ? ` Failed to generate ${failCount} invoices.` : ""
        }`,
      });
      
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast({ title: "Invoicing failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Invoices (Bulk)</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Month For *</Label>
            <Select value={monthFor} onValueChange={setMonthFor}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Select Units ({selectedUnitIds.size}/{billableUnits.length})
              </span>
              {billableUnits.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {selectedUnitIds.size === billableUnits.length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            <div className="divide-y divide-border max-h-48 overflow-y-auto mt-2 border border-border rounded-lg bg-card">
              {billableUnits.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  No occupied units with an active lease.
                </p>
              ) : (
                billableUnits.map((u) => {
                  const lease = leases.find((l) => l.unit_id === u.id);
                  const rent = lease?.monthly_rent || u.monthly_rent || 0;
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`unit-${u.id}`}
                          checked={selectedUnitIds.has(u.id)}
                          onCheckedChange={() => toggleUnit(u.id)}
                        />
                        <label
                          htmlFor={`unit-${u.id}`}
                          className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          <span className="font-semibold">{u.unit_number}</span> — {u.tenant_name || "Tenant"}
                        </label>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        KES {rent.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border mt-auto">
          <Button
            onClick={handleGenerate}
            disabled={generating || !monthFor || selectedUnitIds.size === 0}
            className="w-full h-11"
          >
            {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Generate {selectedUnitIds.size} Invoices
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
