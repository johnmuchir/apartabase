import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { Link } from "react-router-dom";
import { Plus, Building2, MapPin, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", address: "", total_units: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [props, uts] = await Promise.all([
        entities.Property.list("-created_date"),
        entities.Unit.list(),
      ]);
      setProperties(props);
      setUnits(uts);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name || !form.location || !form.total_units) return;
    setSaving(true);
    try {
      await entities.Property.create({
        ...form,
        total_units: parseInt(form.total_units),
      });
      toast({ title: "Property added!" });
      setShowForm(false);
      setForm({ name: "", location: "", address: "", total_units: "" });
      setLoading(true);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Could not save property", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const getPropertyStats = (propId) => {
    const propUnits = units.filter((u) => u.property_id === propId);
    const occupied = propUnits.filter((u) => u.status === "Occupied").length;
    return { total: propUnits.length, occupied, vacant: propUnits.length - occupied };
  };

  if (loading) return (<><PageHeader title="Properties" /><LoadingSpinner /></>);

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={`${properties.length} apartment block${properties.length !== 1 ? "s" : ""}`}
        action={
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="h-8 text-xs">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        }
      />
      <div className="max-w-lg mx-auto px-4 py-4">
        {properties.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No properties yet"
            description="Add your first apartment block to start managing units and tenants."
            actionLabel="Add Property"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-3">
            {properties.map((p) => {
              const s = getPropertyStats(p.id);
              return (
                <Link key={p.id} to={`/properties/${p.id}`}>
                  <div className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow active:scale-[0.99]">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-primary/10">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">{p.location}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <DoorOpen className="w-3 h-3" /> {s.total} units
                          </span>
                          <span className="text-xs text-emerald-600 font-medium">{s.occupied} occupied</span>
                          {s.vacant > 0 && (
                            <span className="text-xs text-red-500 font-medium">{s.vacant} vacant</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Add Property</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Property Name *</Label>
              <Input placeholder="e.g. Sunrise Apartments" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Location *</Label>
              <Input placeholder="e.g. Kilimani, Nairobi" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <Label>Address</Label>
              <Input placeholder="Full address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Total Units *</Label>
              <Input type="number" placeholder="e.g. 24" value={form.total_units} onChange={(e) => setForm({ ...form, total_units: e.target.value })} />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.location || !form.total_units} className="w-full h-12">
              {saving ? "Saving..." : "Add Property"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}