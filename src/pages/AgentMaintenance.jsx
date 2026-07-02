import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { Wrench, CheckCircle2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

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

const filters = ["Open", "In Progress", "Completed", "All"];

export default function AgentMaintenance() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Open");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const reqs = await entities.MaintenanceRequest.list("-created_date");
      setRequests(reqs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await entities.MaintenanceRequest.update(id, { status: newStatus });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      toast({ title: `Marked as ${newStatus}` });
    } catch (e) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleCostSave = async (id, value) => {
    const cost = value === "" ? null : Number(value);
    try {
      await entities.MaintenanceRequest.update(id, { cost });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, cost } : r)));
    } catch (e) {
      toast({ title: "Failed to save cost", variant: "destructive" });
    }
  };

  if (loading) return (<><PageHeader title="Repairs" /><LoadingSpinner /></>);

  const counts = {
    Open: requests.filter((r) => r.status === "Open").length,
    "In Progress": requests.filter((r) => r.status === "In Progress").length,
    Completed: requests.filter((r) => r.status === "Completed").length,
  };
  const filtered = activeFilter === "All" ? requests : requests.filter((r) => r.status === activeFilter);

  // Per-property upkeep totals
  const propertyTotals = {};
  requests.forEach((r) => {
    const key = r.property_id || "unknown";
    if (!propertyTotals[key]) propertyTotals[key] = { name: r.property_name || "Unknown", total: 0, count: 0 };
    propertyTotals[key].total += r.cost || 0;
    propertyTotals[key].count += 1;
  });
  const grandTotal = Object.values(propertyTotals).reduce((s, p) => s + p.total, 0);

  return (
    <div>
      <PageHeader title="Maintenance" subtitle="Manage repair requests" />
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Upkeep cost summary */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total upkeep spend</p>
              <p className="text-lg font-bold">{formatKES(grandTotal)}</p>
            </div>
          </div>
          {Object.keys(propertyTotals).length > 0 && (
            <div className="space-y-2 mt-3 pt-3 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">By property</p>
              {Object.entries(propertyTotals).map(([pid, p]) => (
                <div key={pid} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate">{p.name}</span>
                  <span className="font-semibold ml-2 shrink-0">{formatKES(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f}{f !== "All" ? ` (${counts[f]})` : ""}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Wrench} title="No requests" description={`No ${activeFilter.toLowerCase()} maintenance requests.`} />
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => (
              <div key={req.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{req.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {req.property_name} · {req.unit_number} · {req.tenant_name}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColors[req.status]}`}>
                    {req.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{req.description}</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{req.category}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityColors[req.priority]}`}>{req.priority}</span>
                  </div>
                  {req.status !== "Completed" && (
                    <div className="flex items-center gap-2">
                      {req.status === "Open" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(req.id, "In Progress")}>
                          Start
                        </Button>
                      )}
                      <Button size="sm" onClick={() => handleStatusChange(req.id, "Completed")}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Repair cost:</label>
                  <Input
                    type="number"
                    placeholder="0"
                    defaultValue={req.cost ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if ((v === "" ? null : Number(v)) !== (req.cost ?? null)) handleCostSave(req.id, v);
                    }}
                    className="h-8 text-xs max-w-32"
                  />
                  <span className="text-xs text-muted-foreground">KES</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}