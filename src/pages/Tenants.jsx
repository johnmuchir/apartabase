import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { Plus, Users, Search, Phone, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    full_name: "", phone: "", id_number: "", email: "",
    property_id: "", unit_id: "", lease_start: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, p, u] = await Promise.all([
        entities.Tenant.list("-created_date"),
        entities.Property.list(),
        entities.Unit.list(),
      ]);
      setTenants(t);
      setProperties(p);
      setUnits(u);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const vacantUnits = units.filter((u) => u.status === "Vacant" && u.property_id === form.property_id);

  const handleSave = async () => {
    if (!form.full_name || !form.phone || !form.property_id || !form.unit_id) return;
    setSaving(true);
    try {
      const selectedUnit = units.find((u) => u.id === form.unit_id);
      const selectedProp = properties.find((p) => p.id === form.property_id);

      await entities.Tenant.create({
        ...form,
        unit_number: selectedUnit?.unit_number || "",
        property_name: selectedProp?.name || "",
        monthly_rent: selectedUnit?.monthly_rent || 0,
        status: "Active",
      });

      await entities.Unit.update(form.unit_id, {
        status: "Occupied",
        tenant_name: form.full_name,
      });

      toast({ title: "Tenant added!" });
      setShowForm(false);
      setForm({ full_name: "", phone: "", id_number: "", email: "", property_id: "", unit_id: "", lease_start: "" });
      setLoading(true);
      loadData();
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const filtered = tenants.filter((t) =>
    !search || t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search) || t.unit_number?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (<><PageHeader title="Tenants" /><LoadingSpinner /></>);

  return (
    <div>
      <PageHeader
        title="Tenants"
        subtitle={`${tenants.filter(t => t.status === "Active").length} active`}
        action={
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="h-8 text-xs">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        }
      />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tenants..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No tenants yet"
            description="Register a tenant and assign them to a vacant unit."
            actionLabel="Add Tenant"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <div key={t.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{t.full_name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      <a href={`tel:${t.phone}`} className="text-xs text-primary font-medium">{t.phone}</a>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <DoorOpen className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t.unit_number} · {t.property_name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      t.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {t.status}
                    </span>
                    {t.monthly_rent > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">KES {t.monthly_rent?.toLocaleString()}/mo</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Tenant</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Full Name *</Label>
              <Input placeholder="e.g. John Kamau" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone (M-Pesa) *</Label>
              <Input placeholder="e.g. 0712345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>ID Number</Label>
              <Input placeholder="National ID" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Property *</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v, unit_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.property_id && (
              <div>
                <Label>Vacant Unit *</Label>
                <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {vacantUnits.length === 0 ? (
                      <SelectItem value="none" disabled>No vacant units</SelectItem>
                    ) : (
                      vacantUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.unit_number} — {u.unit_type} (KES {u.monthly_rent?.toLocaleString()})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Lease Start Date</Label>
              <Input type="date" value={form.lease_start} onChange={(e) => setForm({ ...form, lease_start: e.target.value })} />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.full_name || !form.phone || !form.property_id || !form.unit_id} className="w-full h-12">
              {saving ? "Saving..." : "Add Tenant"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}