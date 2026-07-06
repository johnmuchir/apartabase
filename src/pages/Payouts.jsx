import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { entities } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import {
  Wallet, CheckCircle2, Clock, Plus, Loader2, Building2,
  Coins, ShieldCheck, Wrench, AlertCircle, RefreshCw
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

const typeConfig = {
  Commission: { icon: Coins, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", badge: "bg-blue-100 text-blue-800" },
  "Deposit Refund": { icon: RefreshCw, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", badge: "bg-indigo-100 text-indigo-800" },
  Maintenance: { icon: Wrench, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", badge: "bg-orange-100 text-orange-800" },
};

export default function Payouts() {
  const { profile, demoRole, user } = useAuth();
  const { toast } = useToast();
  const isAgent = demoRole === "agent" || profile?.role === "agent";

  const [payouts, setPayouts] = useState([]);
  const [properties, setProperties] = useState([]);
  const [agentProfile, setAgentProfile] = useState(null);
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [pendingReleases, setPendingReleases] = useState([]);
  const [pendingMaintenance, setPendingMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  // Create payout dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    property_id: "", payout_type: "Commission", amount: "",
    payee_name: "", description: "", payout_date: new Date().toISOString().split("T")[0],
    linked_deposit_id: "", linked_account_release_id: "", linked_maintenance_id: ""
  });

  // Confirm payout dialog
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [confirmRef, setConfirmRef] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payoutData, propData, depData, releaseData, maintData] = await Promise.all([
        entities.LandlordPayout.list("-created_date"),
        entities.Property.list(),
        supabase
          .from("tenant_deposits")
          .select("*, tenants(full_name, property_id, property_name)")
          .eq("status", "Pending"),
        supabase
          .from("property_accounts")
          .select("*, properties(name)")
          .eq("status", "Pending"),
        supabase
          .from("maintenance_requests")
          .select("*")
          .eq("status", "Completed")
          .gt("cost", 0)
          .is("payout_id", null)
      ]);
      setPayouts(payoutData || []);
      setProperties(propData || []);
      setPendingDeposits(depData.data || []);
      setPendingReleases(releaseData.data || []);
      setPendingMaintenance(maintData.data || []);

      // Fetch agent profile to show their payment details
      if (!isAgent) {
        const { data: agentProfiles } = await supabase
          .from("profiles").select("*").eq("role", "agent").limit(1);
        if (agentProfiles && agentProfiles.length > 0) setAgentProfile(agentProfiles[0]);
      } else {
        const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        setAgentProfile(me);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.property_id || !createForm.payout_type || !createForm.amount) return;
    setCreating(true);
    try {
      const prop = properties.find((p) => p.id === createForm.property_id);
      const insertData = {
        property_id: createForm.property_id,
        property_name: prop?.name || "",
        payout_type: createForm.payout_type,
        amount: parseFloat(createForm.amount) || 0,
        payee_name: createForm.payee_name || "",
        description: createForm.description || "",
        payout_date: createForm.payout_date,
        status: "Pending",
      };
      if (createForm.payout_type === "Deposit Refund" && createForm.linked_deposit_id) {
        insertData.linked_deposit_id = createForm.linked_deposit_id;
      }
      if (createForm.payout_type === "Commission" && createForm.linked_account_release_id) {
        insertData.linked_account_release_id = createForm.linked_account_release_id;
      }
      if (createForm.payout_type === "Maintenance" && createForm.linked_maintenance_id) {
        insertData.linked_maintenance_id = createForm.linked_maintenance_id;
      }
      const { data: createdPayout, error: insertErr } = await supabase
        .from("landlord_payouts")
        .insert(insertData)
        .select()
        .single();
      if (insertErr) throw insertErr;

      // Link payout_id on the tenant_deposits record immediately
      if (createForm.payout_type === "Deposit Refund" && createForm.linked_deposit_id && createdPayout) {
        await supabase
          .from("tenant_deposits")
          .update({ payout_id: createdPayout.id })
          .eq("id", createForm.linked_deposit_id);
      }

      // Link payout_id and set status on the maintenance request immediately
      if (createForm.payout_type === "Maintenance" && createForm.linked_maintenance_id && createdPayout) {
        await supabase
          .from("maintenance_requests")
          .update({ 
            payout_id: createdPayout.id,
            payout_status: "Pending"
          })
          .eq("id", createForm.linked_maintenance_id);
      }

      toast({ title: "Payout request created! Landlord will be notified." });
      setShowCreate(false);
      setCreateForm({
        property_id: "", payout_type: "Commission", amount: "",
        payee_name: "", description: "", payout_date: new Date().toISOString().split("T")[0],
        linked_deposit_id: "", linked_account_release_id: "", linked_maintenance_id: ""
      });
      loadData();
    } catch (err) {
      toast({ title: "Failed to create payout", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!selectedPayout) return;
    setConfirming(true);
    try {
      const confirmedDate = new Date().toISOString().split("T")[0];
      const { data: updatedPayout, error: updateErr } = await supabase.from("landlord_payouts").update({
        status: "Confirmed",
        reference: confirmRef || null,
        confirmed_date: confirmedDate,
      }).eq("id", selectedPayout.id).select().single();
      if (updateErr) throw updateErr;

      // If this is a Deposit Refund and has a linked_deposit_id, verify it as Refunded and record payout_id!
      if (updatedPayout && updatedPayout.payout_type === "Deposit Refund" && updatedPayout.linked_deposit_id) {
        await supabase.from("tenant_deposits").update({
          status: "Refunded",
          payout_id: updatedPayout.id
        }).eq("id", updatedPayout.linked_deposit_id);
      }

      // If this is a Commission and has a linked_account_release_id, verify it as Paid!
      if (updatedPayout && updatedPayout.payout_type === "Commission" && updatedPayout.linked_account_release_id) {
        await supabase.from("property_accounts").update({
          status: "Paid"
        }).eq("id", updatedPayout.linked_account_release_id);
      }

      // If this is Maintenance and has a linked_maintenance_id, verify it as Paid!
      if (updatedPayout && updatedPayout.payout_type === "Maintenance" && updatedPayout.linked_maintenance_id) {
        await supabase.from("maintenance_requests").update({
          payout_status: "Paid",
          payout_id: updatedPayout.id
        }).eq("id", updatedPayout.linked_maintenance_id);
      }

      toast({ title: "Payout confirmed! Record updated." });
      setSelectedPayout(null);
      setConfirmRef("");
      loadData();
    } catch (err) {
      toast({ title: "Confirmation failed", description: err.message, variant: "destructive" });
    } finally { setConfirming(false); }
  };

  const pending = payouts.filter((p) => p.status === "Pending");
  const confirmed = payouts.filter((p) => p.status === "Confirmed");
  const totalPending = pending.reduce((s, p) => s + (p.amount || 0), 0);
  const totalConfirmed = confirmed.reduce((s, p) => s + (p.amount || 0), 0);

  if (loading) return <><PageHeader title="Payouts" /><LoadingSpinner /></>;

  return (
    <div className="pb-24">
      <PageHeader
        title="Payouts"
        subtitle="Landlord disbursements to agent"
        action={isAgent ? (
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Request
          </Button>
        ) : undefined}
      />

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Pending</p>
            </div>
            <p className="text-lg font-bold text-amber-900">{formatKES(totalPending)}</p>
            <p className="text-[10px] text-amber-700">{pending.length} payout{pending.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Confirmed</p>
            </div>
            <p className="text-lg font-bold text-emerald-900">{formatKES(totalConfirmed)}</p>
            <p className="text-[10px] text-emerald-700">{confirmed.length} payout{confirmed.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Agent payment details (for landlord to know where to send money) */}
        {!isAgent && agentProfile && (agentProfile.mpesa_number || agentProfile.bank_account) && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Agent Payment Details</h3>
            </div>
            <div className="space-y-1.5 text-xs">
              {agentProfile.mpesa_number && (
                <div className="flex justify-between items-center p-2 bg-muted/40 rounded-lg">
                  <span className="text-muted-foreground">M-Pesa Number</span>
                  <span className="font-semibold font-mono text-foreground">{agentProfile.mpesa_number}</span>
                </div>
              )}
              {agentProfile.bank_name && (
                <div className="flex justify-between items-center p-2 bg-muted/40 rounded-lg">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-semibold text-foreground">{agentProfile.bank_name}</span>
                </div>
              )}
              {agentProfile.bank_account && (
                <div className="flex justify-between items-center p-2 bg-muted/40 rounded-lg">
                  <span className="text-muted-foreground">Account No.</span>
                  <span className="font-semibold font-mono text-foreground">{agentProfile.bank_account}</span>
                </div>
              )}
              {agentProfile.bank_paybill && (
                <div className="flex justify-between items-center p-2 bg-muted/40 rounded-lg">
                  <span className="text-muted-foreground">Paybill No.</span>
                  <span className="font-semibold font-mono text-foreground">{agentProfile.bank_paybill}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agent: no payment details set yet */}
        {!isAgent && agentProfile && !agentProfile.mpesa_number && !agentProfile.bank_account && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800">Your agent hasn't added their payment details yet. Ask them to update Settings with their M-Pesa or bank information.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {["pending", "confirmed"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {t} ({t === "pending" ? pending.length : confirmed.length})
            </button>
          ))}
        </div>

        {/* Pending payouts */}
        {tab === "pending" && (
          <div className="space-y-3">
            {pending.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No Pending Payouts" description="All payouts have been confirmed by the agent." />
            ) : (
              pending.map((payout) => {
                const cfg = typeConfig[payout.payout_type] || typeConfig.Commission;
                const Icon = cfg.icon;
                return (
                  <div key={payout.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-sm">{payout.payout_type}</h4>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{payout.payout_type}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{payout.property_name}</p>
                          {payout.payee_name && <p className="text-[11px] text-muted-foreground">For: {payout.payee_name}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-bold text-sm text-foreground">{formatKES(payout.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{payout.payout_date}</p>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-block mt-1">Pending</span>
                      </div>
                    </div>
                    {payout.description && (
                      <p className="text-[11px] text-muted-foreground italic bg-muted/40 px-3 py-2 rounded-lg border border-border/30">"{payout.description}"</p>
                    )}
                    {!isAgent ? (
                      <Button
                        size="sm"
                        onClick={() => { setSelectedPayout(payout); setConfirmRef(""); }}
                        className="w-full h-8 bg-primary hover:bg-primary/95 text-white text-xs font-semibold"
                      >
                        <Wallet className="w-3.5 h-3.5 mr-1.5" /> Pay Now
                      </Button>
                    ) : (
                      <p className="text-[10px] text-amber-700 font-semibold italic text-center">Awaiting Landlord Payment</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Confirmed payouts */}
        {tab === "confirmed" && (
          <div className="space-y-3">
            {confirmed.length === 0 ? (
              <EmptyState icon={Wallet} title="No Confirmed Payouts" description="Confirmed payouts will appear here." />
            ) : (
              confirmed.map((payout) => {
                const cfg = typeConfig[payout.payout_type] || typeConfig.Commission;
                const Icon = cfg.icon;
                return (
                  <div key={payout.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm">{payout.payout_type}</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{payout.property_name}</p>
                          {payout.payee_name && <p className="text-[11px] text-muted-foreground">For: {payout.payee_name}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-bold text-sm text-emerald-700">{formatKES(payout.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{payout.confirmed_date || payout.payout_date}</p>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-block mt-1">Confirmed</span>
                      </div>
                    </div>
                    {payout.description && (
                      <p className="text-[11px] text-muted-foreground italic bg-muted/40 px-3 py-2 rounded-lg border border-border/30">"{payout.description}"</p>
                    )}
                    {payout.reference && (
                      <p className="text-[11px] font-mono text-primary bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20">Ref: {payout.reference}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Create Payout Dialog (Agent) */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader><DialogTitle>Create Payout Request</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex gap-2.5">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800">This creates a payout request for the landlord. The landlord will see a notification and make the payment.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Property *</Label>
              <Select value={createForm.property_id} onValueChange={(v) => setCreateForm({ ...createForm, property_id: v })}>
                <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payout Type *</Label>
              <Select value={createForm.payout_type} onValueChange={(v) => setCreateForm({ ...createForm, payout_type: v })}>
                <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Commission">Agent Commission</SelectItem>
                  <SelectItem value="Deposit Refund">Tenant Deposit Refund</SelectItem>
                  <SelectItem value="Maintenance">Property Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {createForm.payout_type === "Commission" && "Agent retains this as their fee for the month."}
                {createForm.payout_type === "Deposit Refund" && "Agent will forward this to the tenant upon receiving it."}
                {createForm.payout_type === "Maintenance" && "Agent will pay the repair vendor with this amount."}
              </p>
            </div>

            {createForm.payout_type === "Deposit Refund" && (
              <div className="space-y-1.5 border-y border-border/40 py-3 my-2">
                <Label className="text-xs font-semibold text-indigo-700">Select Pending Tenant Deposit Refund *</Label>
                <Select
                  value={createForm.linked_deposit_id}
                  onValueChange={(v) => {
                    const dep = pendingDeposits.find((d) => d.id === v);
                    if (dep) {
                      setCreateForm({
                        ...createForm,
                        linked_deposit_id: v,
                        amount: dep.amount_paid.toString(),
                        payee_name: dep.tenants?.full_name || "",
                        description: `Refund of ${dep.deposit_type} for ${dep.tenants?.full_name || "tenant"}`,
                        property_id: dep.tenants?.property_id || createForm.property_id
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Choose pending deposit" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingDeposits.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.tenants?.full_name || "Tenant"} — {d.deposit_type} ({formatKES(d.amount_paid)})
                      </SelectItem>
                    ))}
                    {pendingDeposits.length === 0 && (
                      <SelectItem value="none" disabled>No pending refunds found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {createForm.payout_type === "Commission" && (
              <div className="space-y-1.5 border-y border-border/40 py-3 my-2">
                <Label className="text-xs font-semibold text-blue-700">Select Pending Property Statement Release *</Label>
                <Select
                  value={createForm.linked_account_release_id}
                  onValueChange={(v) => {
                    const release = pendingReleases.find((r) => r.id === v);
                    if (release) {
                      setCreateForm({
                        ...createForm,
                        linked_account_release_id: v,
                        amount: release.amount_commission.toString(),
                        payee_name: "Property Agent",
                        description: `Agent Commission for monthly statement released on ${release.release_date}`,
                        property_id: release.property_id
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Choose pending statement release" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingReleases.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.properties?.name || "Property"} — Released: {r.release_date} (Commission: {formatKES(r.amount_commission)})
                      </SelectItem>
                    ))}
                    {pendingReleases.length === 0 && (
                      <SelectItem value="none" disabled>No pending statement releases found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {createForm.payout_type === "Maintenance" && (
              <div className="space-y-1.5 border-y border-border/40 py-3 my-2">
                <Label className="text-xs font-semibold text-orange-700">Select Pending Maintenance Request *</Label>
                <Select
                  value={createForm.linked_maintenance_id}
                  onValueChange={(v) => {
                    const maint = pendingMaintenance.find((m) => m.id === v);
                    if (maint) {
                      setCreateForm({
                        ...createForm,
                        linked_maintenance_id: v,
                        amount: maint.cost.toString(),
                        payee_name: "Repair Vendor / Contractor",
                        description: `Maintenance repair: ${maint.title} for Unit ${maint.unit_number}`,
                        property_id: maint.property_id || createForm.property_id
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Choose pending maintenance" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingMaintenance.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.title} ({m.property_name} · Unit {m.unit_number}) — Cost: {formatKES(m.cost)}
                      </SelectItem>
                    ))}
                    {pendingMaintenance.length === 0 && (
                      <SelectItem value="none" disabled>No pending maintenance requests found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Amount (KES) *</Label>
              <Input type="number" placeholder="e.g. 5000" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} className="h-10 text-xs" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payee Name (Tenant / Vendor)</Label>
              <Input placeholder={createForm.payout_type === "Commission" ? "Agent name" : createForm.payout_type === "Deposit Refund" ? "Tenant name" : "Vendor / contractor name"} value={createForm.payee_name} onChange={(e) => setCreateForm({ ...createForm, payee_name: e.target.value })} className="h-10 text-xs" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description / Notes</Label>
              <Input placeholder="e.g. July commission, Unit 3 deposit refund..." value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="h-10 text-xs" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payout Date *</Label>
              <Input type="date" value={createForm.payout_date} onChange={(e) => setCreateForm({ ...createForm, payout_date: e.target.value })} className="h-10 text-xs" required />
            </div>

            <Button type="submit" disabled={creating || !createForm.property_id || !createForm.amount} className="w-full h-11">
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create Payout Request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Payout Dialog (Landlord) */}
      <Dialog open={!!selectedPayout} onOpenChange={(open) => !open && setSelectedPayout(null)}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader><DialogTitle>Send Payout Payment</DialogTitle></DialogHeader>
          {selectedPayout && (
            <form onSubmit={handleConfirm} className="space-y-4 pt-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-1.5">
                <p className="font-semibold text-emerald-950">Payout request details</p>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-semibold">{selectedPayout.payout_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Property</span><span className="font-semibold">{selectedPayout.property_name}</span></div>
                {selectedPayout.payee_name && <div className="flex justify-between"><span className="text-muted-foreground">For</span><span className="font-semibold">{selectedPayout.payee_name}</span></div>}
                {selectedPayout.description && <div className="flex justify-between"><span className="text-muted-foreground">Details</span><span className="font-semibold text-right">{selectedPayout.description}</span></div>}
                <div className="flex justify-between border-t border-emerald-200 pt-1.5 font-bold text-emerald-900">
                  <span>Amount to Send</span><span>{formatKES(selectedPayout.amount)}</span>
                </div>
              </div>

              {agentProfile && (agentProfile.mpesa_number || agentProfile.bank_account) && (
                <div className="bg-card border border-border rounded-xl p-3.5 space-y-2 text-xs">
                  <p className="font-bold flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-primary" /> Send money to Agent:
                  </p>
                  <div className="space-y-1 font-mono">
                    {agentProfile.mpesa_number && (
                      <div className="flex justify-between"><span>M-Pesa:</span><span className="font-bold">{agentProfile.mpesa_number}</span></div>
                    )}
                    {agentProfile.bank_name && (
                      <div className="flex justify-between"><span>Bank:</span><span className="font-bold">{agentProfile.bank_name}</span></div>
                    )}
                    {agentProfile.bank_account && (
                      <div className="flex justify-between"><span>Account:</span><span className="font-bold">{agentProfile.bank_account}</span></div>
                    )}
                    {agentProfile.bank_paybill && (
                      <div className="flex justify-between"><span>Paybill:</span><span className="font-bold">{agentProfile.bank_paybill}</span></div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">M-Pesa Code / Transaction Reference *</Label>
                <Input
                  placeholder="e.g. QHK7ABCD12 or bank wire ref"
                  value={confirmRef}
                  onChange={(e) => setConfirmRef(e.target.value)}
                  className="h-10 text-xs"
                  required
                />
              </div>

              <Button type="submit" disabled={confirming || !confirmRef} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                {confirming ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</> : <><CheckCircle2 className="w-4 h-4 mr-1.5" /> I Have Sent Payment</>}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
