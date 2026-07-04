import React, { useState, useEffect } from "react";
import { entities, integrations } from "@/api/supabaseClient";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, DoorOpen, User, Trash2, MapPin, ChevronDown, Settings, Edit, Download, FileText, Landmark, FileDown, Loader2 } from "lucide-react";
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
  const { profile, demoRole } = useAuth();
  
  const [property, setProperty] = useState(null);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [maintenanceReqs, setMaintenanceReqs] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedUnitId, setExpandedUnitId] = useState(null);
  const [form, setForm] = useState({ unit_number: "", unit_type: "1 Bedroom", floor: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isAgent = demoRole === "agent" || profile?.role === "agent";

  // Tab State
  const [activeTab, setActiveTab] = useState("units");

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    location: "",
    address: "",
    total_units: "",
    commission_type: "percentage",
    commission_rate: 0,
    bank_name: "",
    account_number: "",
    paybill_number: "",
    account_name: "",
  });
  const [settingsImageFile, setSettingsImageFile] = useState(null);
  const [settingsContractFile, setSettingsContractFile] = useState(null);
  const [settingsComplianceFile, setSettingsComplianceFile] = useState(null);
  const [existingContractUrl, setExistingContractUrl] = useState(null);
  const [existingComplianceUrl, setExistingComplianceUrl] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleLeaseUpdated = (leaseId, data) => setLeases((prev) => prev.map((l) => (l.id === leaseId ? { ...l, ...data } : l)));

  useEffect(() => {
    if (property) {
      setSettingsForm({
        name: property.name || "",
        location: property.location || "",
        address: property.address || "",
        total_units: property.total_units || "",
        commission_type: property.commission_type || "percentage",
        commission_rate: property.commission_rate || 0,
        bank_name: property.bank_name || "",
        account_number: property.account_number || "",
        paybill_number: property.paybill_number || "",
        account_name: property.account_name || "",
      });
      setExistingContractUrl(property.contract_url || null);
      setExistingComplianceUrl(property.compliance_url || null);
      setExistingImageUrl(property.image_url || null);
    }
  }, [property]);

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
    if (!form.unit_number) return;
    setSaving(true);
    try {
      await entities.Unit.create({
        property_id: id,
        unit_number: form.unit_number.trim(),
        unit_type: form.unit_type,
        floor: form.floor ? form.floor.trim() : null,
        status: "Vacant",
        monthly_rent: 0,
      });
      toast({ title: "Unit created successfully!" });
      setShowForm(false);
      setForm({ unit_number: "", unit_type: "1 Bedroom", floor: "" });
      setLoading(true);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.message || "Could not create unit", variant: "destructive" });
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

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      let uploadedImageUrl = existingImageUrl;
      let uploadedContractUrl = existingContractUrl;
      let uploadedComplianceUrl = existingComplianceUrl;

      const uploads = [];
      if (settingsImageFile) {
        uploads.push(
          integrations.Core.UploadFile({ file: settingsImageFile }).then(res => {
            uploadedImageUrl = res?.url || null;
          })
        );
      }
      if (settingsContractFile) {
        uploads.push(
          integrations.Core.UploadFile({ file: settingsContractFile }).then(res => {
            uploadedContractUrl = res?.url || null;
          })
        );
      }
      if (settingsComplianceFile) {
        uploads.push(
          integrations.Core.UploadFile({ file: settingsComplianceFile }).then(res => {
            uploadedComplianceUrl = res?.url || null;
          })
        );
      }

      await Promise.all(uploads);

      const { error } = await supabase
        .from("properties")
        .update({
          name: settingsForm.name.trim(),
          location: settingsForm.location.trim(),
          address: settingsForm.address.trim(),
          total_units: parseInt(settingsForm.total_units) || 0,
          commission_type: settingsForm.commission_type,
          commission_rate: parseFloat(settingsForm.commission_rate) || 0,
          bank_name: settingsForm.bank_name.trim(),
          account_number: settingsForm.account_number.trim(),
          paybill_number: settingsForm.paybill_number.trim(),
          account_name: settingsForm.account_name.trim(),
          image_url: uploadedImageUrl,
          contract_url: uploadedContractUrl,
          compliance_url: uploadedComplianceUrl,
        })
        .eq("id", property.id);

      if (error) throw error;

      toast({ title: "Settings updated successfully!" });
      
      const prop = await entities.Property.get(property.id);
      setProperty(prop);
      setSettingsImageFile(null);
      setSettingsContractFile(null);
      setSettingsComplianceFile(null);
    } catch (err) {
      toast({
        title: "Error saving settings",
        description: err.message || "Could not update settings",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
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

        {/* Tab Buttons */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("units")}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center transition-colors ${
              activeTab === "units"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Units ({units.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center transition-colors ${
              activeTab === "settings"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Settings & Documents
          </button>
        </div>

        {activeTab === "units" && (
          <>
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
                          <UnitLeaseCard unit={u} leases={leases} onLeaseUpdated={loadData} propertyName={property.name} />
                          <UnitHistoryCard unit={u} tenants={tenants} maintenanceReqs={maintenanceReqs} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "settings" && (
          <form onSubmit={handleSaveSettings} className="space-y-4 pb-20">
            {/* General Settings */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 border-b border-border pb-2">
                <Settings className="w-4.5 h-4.5 text-primary" /> General Details
              </h3>
              <div>
                <Label>Property Name *</Label>
                <Input
                  disabled={!isAgent}
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Location *</Label>
                <Input
                  disabled={!isAgent}
                  value={settingsForm.location}
                  onChange={(e) => setSettingsForm({ ...settingsForm, location: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  disabled={!isAgent}
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Total Units *</Label>
                <Input
                  type="number"
                  disabled={!isAgent}
                  value={settingsForm.total_units}
                  onChange={(e) => setSettingsForm({ ...settingsForm, total_units: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label className="block mb-1">Property Thumbnail Image</Label>
                {existingImageUrl && (
                  <div className="mb-2">
                    <img src={existingImageUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-border" />
                  </div>
                )}
                {isAgent && (
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSettingsImageFile(e.target.files?.[0])}
                  />
                )}
              </div>
            </div>

            {/* Commission Settings */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 border-b border-border pb-2">
                <Landmark className="w-4.5 h-4.5 text-primary" /> Commission Settings
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Commission Type</Label>
                  <Select
                    disabled={!isAgent}
                    value={settingsForm.commission_type}
                    onValueChange={(v) => setSettingsForm({ ...settingsForm, commission_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed (KES)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>
                    {settingsForm.commission_type === "percentage" ? "Percentage Rate (%)" : "Fixed Amount (KES)"}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    disabled={!isAgent}
                    value={settingsForm.commission_rate}
                    onChange={(e) => setSettingsForm({ ...settingsForm, commission_rate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Property Accounts */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 border-b border-border pb-2">
                <Landmark className="w-4.5 h-4.5 text-primary" /> Payment Accounts
              </h3>
              <div>
                <Label>Bank Name</Label>
                <Input
                  disabled={!isAgent}
                  placeholder="e.g. Equity Bank"
                  value={settingsForm.bank_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bank_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input
                  disabled={!isAgent}
                  placeholder="Bank Account Number"
                  value={settingsForm.account_number}
                  onChange={(e) => setSettingsForm({ ...settingsForm, account_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Paybill Number (M-Pesa)</Label>
                <Input
                  disabled={!isAgent}
                  placeholder="e.g. 247247"
                  value={settingsForm.paybill_number}
                  onChange={(e) => setSettingsForm({ ...settingsForm, paybill_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Account Name</Label>
                <Input
                  disabled={!isAgent}
                  placeholder="M-Pesa Account Name / Business Name"
                  value={settingsForm.account_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, account_name: e.target.value })}
                />
              </div>
            </div>

            {/* Property Documents */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 border-b border-border pb-2">
                <FileText className="w-4.5 h-4.5 text-primary" /> Property Documents
              </h3>
              
              <div>
                <Label className="block mb-1">Contract / Agreement (Landlord & Agent)</Label>
                {existingContractUrl && (
                  <div className="flex items-center gap-2 mb-2 text-xs bg-muted p-2 rounded-lg border border-border">
                    <FileDown className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate flex-1 font-medium">Contract Agreement</span>
                    <a href={existingContractUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold shrink-0">
                      View Contract
                    </a>
                  </div>
                )}
                {isAgent && (
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setSettingsContractFile(e.target.files?.[0])}
                  />
                )}
              </div>

              <div>
                <Label className="block mb-1">Compliance & Registration Documents</Label>
                {existingComplianceUrl && (
                  <div className="flex items-center gap-2 mb-2 text-xs bg-muted p-2 rounded-lg border border-border">
                    <FileDown className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate flex-1 font-medium">Compliance Document</span>
                    <a href={existingComplianceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold shrink-0">
                      View Document
                    </a>
                  </div>
                )}
                {isAgent && (
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setSettingsComplianceFile(e.target.files?.[0])}
                  />
                )}
              </div>
            </div>

            {isAgent && (
              <div className="pt-2 space-y-3">
                <Button type="submit" className="w-full h-11" disabled={savingSettings}>
                  {savingSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Changes
                    </>
                  ) : (
                    "Save Property Settings"
                  )}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50 h-11">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Property
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-sm mx-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{property.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this property. Units and tenants linked to it will remain but lose their association.
                        <div className="mt-3 space-y-1.5 text-left">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase">Type the property name "{property.name}" to confirm:</Label>
                          <Input 
                            placeholder="Type property name" 
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteProperty} 
                        disabled={deleteConfirmText !== property.name}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </form>
        )}
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
            <div>
              <Label>Floor Number</Label>
              <Input placeholder="e.g. Ground, 1st, 2nd" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            </div>
            <Button onClick={handleAddUnit} disabled={saving || !form.unit_number} className="w-full h-12">
              {saving ? "Saving..." : "Add Unit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}