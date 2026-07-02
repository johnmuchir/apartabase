import React, { useState, useEffect } from "react";
import { entities, integrations } from "@/api/supabaseClient";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, DoorOpen, User, Trash2, MapPin, ChevronDown } from "lucide-react";
import UnitHistoryCard from "@/components/properties/UnitHistoryCard";
import UnitLeaseCard from "@/components/properties/UnitLeaseCard";
import ShareUnitButton from "@/components/properties/ShareUnitButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import StatCard from "@/components/shared/StatCard";
import { useToast } from "@/components/ui/use-toast";

const unitTypes = ["Bedsitter", "1 Bedroom", "2 Bedroom", "3 Bedroom", "Studio", "Shop/Commercial"];

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [maintenanceReqs, setMaintenanceReqs] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedUnitId, setExpandedUnitId] = useState(null);
  const [form, setForm] = useState({ unit_number: "", unit_type: "1 Bedroom", monthly_rent: "", deposit: "" });
  const [leaseFile, setLeaseFile] = useState(null);
  const [inspectionFile, setInspectionFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleLeaseUpdated = (leaseId, data) => setLeases((prev) => prev.map((l) => (l.id === leaseId ? { ...l, ...data } : l)));

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [prop, uts, tens, maint, lses] = await Promise.all([
        entities.Property.get(id),
        entities.Unit.filter({ property_id: id }),
        entities.Tenant.filter({ property_id: id }),
        entities.MaintenanceRequest.filter({ property_id: id }),
        entities.Lease.filter({ property_id: id }),
      ]);
      setProperty(prop);
      setUnits(uts);
      setTenants(tens);
      setMaintenanceReqs(maint);
      setLeases(lses);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAddUnit = async () => {
    if (!form.unit_number || !form.monthly_rent || !form.deposit) return;
    setSaving(true);
    try {
      const [leaseUpload, inspectionUpload] = await Promise.all([
        leaseFile ? integrations.Core.UploadFile({ file: leaseFile }) : Promise.resolve(null),
        inspectionFile ? integrations.Core.UploadFile({ file: inspectionFile }) : Promise.resolve(null),
      ]);
      const unit = await entities.Unit.create({
        property_id: id,
        unit_number: form.unit_number,
        unit_type: form.unit_type,
        monthly_rent: parseInt(form.monthly_rent),
        status: "Vacant",
      });
      await entities.Lease.create({
        unit_id: unit.id,
        property_id: id,
        deposit: parseInt(form.deposit),
        monthly_rent: parseInt(form.monthly_rent),
        lease_agreement_url: leaseUpload?.file_url || null,
        inspection_before_url: inspectionUpload?.file_url || null,
        status: "Active",
      });
      toast({ title: "Unit & lease created!" });
      setShowForm(false);
      setForm({ unit_number: "", unit_type: "1 Bedroom", monthly_rent: "", deposit: "" });
      setLeaseFile(null);
      setInspectionFile(null);
      setLoading(true);
      loadData();
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteProperty = async () => {
    try {
      await entities.Property.delete(id);
      toast({ title: "Property deleted" });
      navigate("/properties");
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (loading) return (<><PageHeader title="..." backPath="/properties" /><LoadingSpinner /></>);
  if (!property) return (<><PageHeader title="Not Found" backPath="/properties" /><p className="text-center py-10 text-muted-foreground">Property not found.</p></>);

  const occupied = units.filter((u) => u.status === "Occupied").length;
  const totalRent = units.reduce((s, u) => s + (u.monthly_rent || 0), 0);

  return (
    <div>
      <PageHeader
        title={property.name}
        subtitle={property.location}
        backPath="/properties"
        action={
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="h-8 text-xs">
            <Plus className="w-4 h-4 mr-1" /> Unit
          </Button>
        }
      />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {property.address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" /> {property.address}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <StatCard icon={DoorOpen} label="Units" value={units.length} color="blue" />
          <StatCard icon={User} label="Occupied" value={occupied} color="success" />
          <StatCard icon={DoorOpen} label="Rent/Mo" value={`${(totalRent / 1000).toFixed(0)}K`} color="primary" />
        </div>

        {units.length === 0 ? (
          <EmptyState
            icon={DoorOpen}
            title="No units yet"
            description="Add units to this property."
            actionLabel="Add Unit"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-2">
            {units.map((u) => {
              const isExpanded = expandedUnitId === u.id;
              return (
                <div key={u.id} className="bg-card rounded-xl border border-border p-3.5 shadow-sm">
                  <button
                    onClick={() => setExpandedUnitId(isExpanded ? null : u.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{u.unit_number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          u.status === "Occupied" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                        }`}>
                          {u.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {u.unit_type} · KES {(u.monthly_rent || 0).toLocaleString()}/mo
                      </p>
                      {u.tenant_name && (
                        <p className="text-xs text-primary mt-0.5 font-medium">{u.tenant_name}</p>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {u.status === "Vacant" && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <ShareUnitButton unit={u} property={property} />
                    </div>
                  )}
                  {isExpanded && (
                    <>
                      <UnitLeaseCard unit={u} leases={leases} onLeaseUpdated={handleLeaseUpdated} />
                      <UnitHistoryCard unit={u} tenants={tenants} maintenanceReqs={maintenanceReqs} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50 mt-4">
              <Trash2 className="w-4 h-4 mr-2" /> Delete Property
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{property.name}"?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete this property. Units and tenants linked to it will remain but lose their association.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteProperty} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader><DialogTitle>Add Unit</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Unit Number *</Label>
              <Input placeholder="e.g. A1" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} />
            </div>
            <div>
              <Label>Unit Type</Label>
              <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {unitTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monthly Rent (KES) *</Label>
                <Input type="number" placeholder="e.g. 25000" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} />
              </div>
              <div>
                <Label>Deposit (KES) *</Label>
                <Input type="number" placeholder="e.g. 25000" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Lease Agreement</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setLeaseFile(e.target.files?.[0])} />
            </div>
            <div>
              <Label>Inspection Report (Before)</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setInspectionFile(e.target.files?.[0])} />
            </div>
            <Button onClick={handleAddUnit} disabled={saving || !form.unit_number || !form.monthly_rent || !form.deposit} className="w-full h-12">
              {saving ? "Saving..." : "Add Unit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}