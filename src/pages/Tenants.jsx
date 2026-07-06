import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Users, Search, Phone, DoorOpen, Wallet, ChevronDown, ChevronUp, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

export default function Tenants() {
  const { profile, demoRole } = useAuth();
  const isAgent = demoRole === "agent" || profile?.role === "agent";

  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [expandedTenantIds, setExpandedTenantIds] = useState(new Set());
  const [confirmDeleteTenant, setConfirmDeleteTenant] = useState(null);
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
      const [t, p, u, d, payoutList] = await Promise.all([
        entities.Tenant.list("-created_date"),
        entities.Property.list(),
        entities.Unit.list(),
        entities.TenantDeposit.list(),
        entities.LandlordPayout.list(),
      ]);
      setTenants(t);
      setProperties(p);
      setUnits(u);
      setDeposits(d || []);
      setPayouts(payoutList || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleVerifyDepositRefund = async (depId) => {
    try {
      await supabase.from("tenant_deposits").update({ status: "Refunded" }).eq("id", depId);
      toast({ title: "Refund verified as paid to tenant!" });
      loadData();
    } catch (e) {
      toast({ title: "Failed to verify refund", variant: "destructive" });
    }
  };

  const getMonthsDormant = (leaseEnd) => {
    if (!leaseEnd) return 0;
    const end = new Date(leaseEnd);
    const now = new Date();
    const diffTime = Math.abs(now - end);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays / 30;
  };

  const isDormantThreeMonths = (t) => {
    if (t.status !== "Inactive" || !t.lease_end) return false;
    return getMonthsDormant(t.lease_end) >= 3;
  };

  const handleDeleteTenantData = async (tenantId) => {
    setSaving(true);
    try {
      // 1. Delete associated payments
      await supabase.from("payments").delete().eq("tenant_id", tenantId);
      
      // 2. Delete associated invoices
      await supabase.from("invoices").delete().eq("tenant_id", tenantId);

      // 3. Delete associated tenant_deposits
      await supabase.from("tenant_deposits").delete().eq("tenant_id", tenantId);

      // 4. Delete associated vacate notices
      await supabase.from("vacate_notices").delete().eq("tenant_id", tenantId);

      // 5. Delete associated evictions
      await supabase.from("evictions").delete().eq("tenant_id", tenantId);

      // 6. Delete associated maintenance requests
      await supabase.from("maintenance_requests").delete().eq("tenant_id", tenantId);

      // 7. Delete associated leases
      await supabase.from("leases").delete().eq("tenant_id", tenantId);

      // 8. Delete the tenant record itself
      await supabase.from("tenants").delete().eq("id", tenantId);

      toast({ title: "Tenant and all associated data permanently deleted!" });
      setConfirmDeleteTenant(null);
      loadData();
    } catch (err) {
      toast({ title: "Deletion failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleExpandTenant = (id) => {
    const next = new Set(expandedTenantIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedTenantIds(next);
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
                    {t.status === "Inactive" && t.lease_end && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Checked out: <span className="font-semibold">{t.lease_end}</span>
                        {isDormantThreeMonths(t) ? (
                          <span className="text-red-600 font-semibold ml-1.5">(Dormant &gt;3 months)</span>
                        ) : (
                          <span className="italic ml-1.5">({Math.floor(getMonthsDormant(t.lease_end) * 10) / 10} mo dormant)</span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => toggleExpandTenant(t.id)}
                      className="text-[10px] text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 mt-2.5 transition-colors"
                    >
                      {expandedTenantIds.has(t.id) ? (
                        <>Hide Details <ChevronUp className="w-3.5 h-3.5" /></>
                      ) : (
                        <>View Details <ChevronDown className="w-3.5 h-3.5" /></>
                      )}
                    </button>
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
                    {isDormantThreeMonths(t) && isAgent && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setConfirmDeleteTenant(t)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 mt-2 block ml-auto"
                        title="Delete dormant tenant and all data"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Collapsible Details */}
                {expandedTenantIds.has(t.id) && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-3.5">
                    {/* Extra Tenant Info */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] bg-muted/30 p-3 rounded-xl border border-border/40">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase tracking-wider font-bold">National ID</span>
                        <span className="font-semibold text-foreground">{t.id_number || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase tracking-wider font-bold">Email</span>
                        <span className="font-semibold text-foreground truncate block">{t.email || "—"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground block text-[9px] uppercase tracking-wider font-bold">Lease Start Date</span>
                        <span className="font-semibold text-foreground">{t.lease_start || "—"}</span>
                      </div>
                    </div>

                    {/* Deposits List */}
                    {deposits.filter((d) => d.tenant_id === t.id).length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Wallet className="w-3 h-3 text-primary" /> Refundable Deposits
                        </p>
                        <div className="space-y-2">
                          {deposits
                            .filter((d) => d.tenant_id === t.id)
                            .map((dep) => {
                              const linkedPayout = payouts.find((p) => p.id === dep.payout_id || p.linked_deposit_id === dep.id);
                              const canVerify = dep.status === "Pending" && linkedPayout?.status === "Confirmed" && isAgent;

                              return (
                                <div key={dep.id} className="bg-muted/40 p-3 rounded-xl border border-border/30 flex flex-col gap-2 text-[11px]">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground truncate font-medium">{dep.deposit_type}</span>
                                    <div className="shrink-0 flex items-center gap-2">
                                      <span className="font-semibold text-foreground">KES {dep.amount_paid.toLocaleString()}</span>
                                      <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                                        dep.status === "Held"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : dep.status === "Refunded"
                                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                          : "bg-amber-50 text-amber-700 border border-amber-200"
                                      }`}>
                                        {dep.status}
                                      </span>
                                    </div>
                                  </div>

                                  {/* If Pending, show payout reference status and verification button */}
                                  {dep.status === "Pending" && (
                                    <div className="flex items-center justify-between bg-muted/60 p-2 rounded-lg border border-border/20 mt-1">
                                      <div className="text-[10px] text-muted-foreground">
                                        {linkedPayout ? (
                                          linkedPayout.status === "Confirmed" ? (
                                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                              <CheckCircle2 className="w-3 h-3" /> Landlord Paid
                                            </span>
                                          ) : (
                                            <span className="text-amber-700 font-semibold flex items-center gap-1">
                                              <Clock className="w-3 h-3" /> Awaiting Landlord
                                            </span>
                                          )
                                        ) : (
                                          <span className="italic">No payout request created</span>
                                        )}
                                      </div>

                                      {canVerify && (
                                        <Button
                                          size="sm"
                                          onClick={() => handleVerifyDepositRefund(dep.id)}
                                          className="h-6 text-[9px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded"
                                        >
                                          Confirm Refunded
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
      <Dialog open={!!confirmDeleteTenant} onOpenChange={(open) => !open && setConfirmDeleteTenant(null)}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" /> Delete Dormant Tenant
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Are you sure you want to permanently delete <strong>{confirmDeleteTenant?.full_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-800 space-y-1.5">
              <p className="font-semibold">This will permanently delete ALL data relating to this tenant:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Leases & Inspection Records</li>
                <li>Monthly Invoices & Damages Invoices</li>
                <li>Rent Payments & Deposit Offsets</li>
                <li>Security Deposit Ledgers</li>
                <li>Maintenance Requests & Vacate Notices</li>
              </ul>
              <p className="font-medium pt-1">This action is irreversible.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteTenant(null)} className="w-1/2 h-10 text-xs">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteTenantData(confirmDeleteTenant.id)}
                disabled={saving}
                className="w-1/2 h-10 text-xs font-semibold bg-red-600 hover:bg-red-700"
              >
                {saving ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}