import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { loadDemoTenant } from "@/lib/demoTenant";
import { Wrench, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

const priorityColors = {
  Low: "bg-blue-100 text-blue-700",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

const statusColors = {
  Open: "bg-amber-100 text-amber-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Completed: "bg-emerald-100 text-emerald-700",
};

export default function TenantMaintenance() {
  const [tenant, setTenant] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "Plumbing", priority: "Medium" });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { tenant: t } = await loadDemoTenant();
      if (t) {
        setTenant(t);
        const reqs = await entities.MaintenanceRequest.filter({ tenant_id: t.id }, "-created_date");
        setRequests(reqs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await entities.MaintenanceRequest.create({
        ...form,
        tenant_id: tenant.id,
        tenant_name: tenant.full_name,
        unit_id: tenant.unit_id,
        unit_number: tenant.unit_number,
        property_id: tenant.property_id,
        property_name: tenant.property_name,
        status: "Open",
      });
      toast({ title: "Maintenance request submitted" });
      setForm({ title: "", description: "", category: "Plumbing", priority: "Medium" });
      setDialogOpen(false);
      loadData();
    } catch (e) {
      toast({ title: "Failed to submit request", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (<><PageHeader title="Repairs" /><LoadingSpinner /></>);

  return (
    <div>
      <PageHeader title="Maintenance" subtitle={tenant ? `${tenant.unit_number} · ${tenant.property_name}` : "Repairs"} />
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <Button onClick={() => setDialogOpen(true)} className="w-full h-12">
          <Plus className="w-4 h-4 mr-2" /> New Request
        </Button>

        {requests.length === 0 ? (
          <EmptyState icon={Wrench} title="No requests yet" description="Submit a maintenance request for your unit." />
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold">{req.title}</h3>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColors[req.status]}`}>
                    {req.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{req.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{req.category}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityColors[req.priority]}`}>{req.priority}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Maintenance Request</DialogTitle>
          </DialogHeader>
          <div className="!mt-4 space-y-3">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Leaking kitchen tap" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Plumbing">Plumbing</SelectItem>
                  <SelectItem value="Electrical">Electrical</SelectItem>
                  <SelectItem value="Structural">Structural</SelectItem>
                  <SelectItem value="Appliance">Appliance</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue..." rows={3} />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}