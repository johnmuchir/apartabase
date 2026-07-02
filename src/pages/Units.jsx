import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import { DoorOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

export default function Units() {
  const [units, setUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const currentMonth = new Date().toLocaleString("en", { month: "long", year: "numeric" });

  useEffect(() => {
    const load = async () => {
      try {
        const [uts, props] = await Promise.all([
          entities.Unit.list("-created_date"),
          entities.Property.list(),
        ]);
        setUnits(uts);
        setProperties(props);
        try {
          const pays = await entities.Payment.list("-payment_date", 200);
          setPayments(pays);
        } catch (e) { console.error(e); }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const propMap = {};
  properties.forEach((p) => { propMap[p.id] = p.name; });

  const paidUnitIds = new Set(payments.filter((p) => p.month_for === currentMonth && p.unit_id).map((p) => p.unit_id));
  const isOverdue = (u) => u.status === "Occupied" && !paidUnitIds.has(u.id);

  const filtered = units.filter((u) => {
    const matchesSearch = !search || u.unit_number?.toLowerCase().includes(search.toLowerCase()) ||
      u.tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
      propMap[u.property_id]?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "Overdue" ? isOverdue(u) : (filter === "All" || u.status === filter);
    return matchesSearch && matchesFilter;
  });

  if (loading) return (<><PageHeader title="Units" /><LoadingSpinner /></>);

  return (
    <div>
      <PageHeader title="All Units" subtitle={`${units.length} total · ${units.filter(u => u.status === "Vacant").length} vacant · ${units.filter(isOverdue).length} overdue`} />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search units..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="flex gap-2">
          {["All", "Occupied", "Vacant", "Overdue"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={DoorOpen} title="No units found" description={search || filter !== "All" ? "Try a different search or filter." : "Add units from a property page."} />
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <div key={u.id} className="bg-card rounded-xl border border-border p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{u.unit_number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        u.status === "Occupied" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      }`}>
                        {u.status}
                      </span>
                      {isOverdue(u) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Overdue</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {propMap[u.property_id] || "—"} · {u.unit_type}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">KES {(u.monthly_rent || 0).toLocaleString()}</p>
                    {u.tenant_name && <p className="text-[11px] text-primary font-medium">{u.tenant_name}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}