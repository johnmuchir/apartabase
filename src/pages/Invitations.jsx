import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { Plus, Mail, Copy, Check, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/ui/use-toast";

const rolesList = ["agent", "landlord", "tenant", "caretaker"];

export default function Invitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({ email: "", full_name: "", role: "tenant" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await entities.Invitation.list("-created_date");
      setInvitations(data);
    } catch (e) {
      console.error("Failed to load invitations:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!form.email || !form.full_name || !form.role) return;
    setSaving(true);
    try {
      const token = crypto.randomUUID();
      await entities.Invitation.create({
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name.trim(),
        role: form.role,
        token: token,
        status: "pending",
      });

      toast({ title: "Invitation generated successfully!" });
      setShowForm(false);
      setForm({ email: "", full_name: "", role: "tenant" });
      setLoading(true);
      loadData();
    } catch (e) {
      toast({
        title: "Error creating invitation",
        description: e.message || "Email might already be invited.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInviteLink = (inv) => {
    return `${window.location.origin}/accept-invite?email=${encodeURIComponent(inv.email)}&token=${inv.token}`;
  };

  const handleCopy = (inv) => {
    const link = getInviteLink(inv);
    navigator.clipboard.writeText(link);
    setCopiedId(inv.id);
    toast({ title: "Invite link copied to clipboard!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return (<><PageHeader title="Invitations" /><LoadingSpinner /></>);

  return (
    <div>
      <PageHeader
        title="Invitations"
        subtitle="Manage and send private registration links"
        action={
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="h-8 text-xs">
            <Plus className="w-4 h-4 mr-1" /> Invite User
          </Button>
        }
      />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {invitations.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No invitations yet"
            description="Invite agents, landlords, caretakers, or tenants to register on ApartaBase."
            actionLabel="Send Invitation"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{inv.full_name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{inv.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">
                        {inv.role}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        inv.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                  {inv.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(inv)}
                      className="h-8 text-xs shrink-0 flex items-center gap-1.5"
                    >
                      {copiedId === inv.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Link
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Send Invitation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g. Mary Wanjiku"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="e.g. mary@gmail.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolesList.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleInvite}
              disabled={saving || !form.email || !form.full_name}
              className="w-full h-12"
            >
              {saving ? "Creating Invite..." : "Create Invitation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
