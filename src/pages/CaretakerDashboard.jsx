import React, { useState, useEffect } from "react";
import { entities } from "@/api/supabaseClient";
import {
  Building2, DoorOpen, Users, Wrench,
  CheckCircle2, Clock, AlertCircle, Loader2
} from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const priorityColors = {
  Low:    "bg-blue-100 text-blue-700",
  Medium: "bg-amber-100 text-amber-700",
  High:   "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

const statusColors = {
  Open:        "bg-amber-100 text-amber-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Completed:   "bg-emerald-100 text-emerald-700",
};

export default function CaretakerDashboard() {
  const [properties, setProperties]   = useState([]);
  const [units, setUnits]             = useState([]);
  const [tenants, setTenants]         = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeFilter, setActiveFilter] = useState("Open");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [props, allUnits, allTenants, mReqs] = await Promise.all([
        entities.Property.list(),
        entities.Unit.list(),
        entities.Tenant.filter({ status: "Active" }),
        entities.MaintenanceRequest.list("-created_date"),
      ]);
      setProperties(props);
      setUnits(allUnits);
      setTenants(allTenants);
      setMaintenance(mReqs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <><PageHeader title="Site Overview" /><LoadingSpinner /></>;

  const occupied = units.filter((u) => u.status === "Occupied").length;
  const vacant   = units.length - occupied;

  const mFilters = ["Open", "In Progress", "Completed", "All"];
  const mCounts  = {
    Open:         maintenance.filter((r) => r.status === "Open").length,
    "In Progress": maintenance.filter((r) => r.status === "In Progress").length,
    Completed:    maintenance.filter((r) => r.status === "Completed").length,
  };
  const filteredM =
    activeFilter === "All"
      ? maintenance
      : maintenance.filter((r) => r.status === activeFilter);

  return (
    <div>
      <PageHeader
        title="Site Overview"
        subtitle="Caretaker dashboard — property operations"
      />

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            icon={Building2}
            label="Properties"
            value={properties.length}
            color="text-indigo-500"
            bg="bg-indigo-50"
          />
          <StatTile
            icon={DoorOpen}
            label="Occupied"
            value={occupied}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
          <StatTile
            icon={DoorOpen}
            label="Vacant"
            value={vacant}
            color="text-amber-600"
            bg="bg-amber-50"
          />
        </div>

        {/* Properties & their occupants */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Properties &amp; Occupants
          </h2>

          {properties.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No properties"
              description="No properties have been assigned yet."
            />
          ) : (
            properties.map((prop) => {
              const propUnits   = units.filter((u) => u.property_id === prop.id);
              const propTenants = tenants.filter((t) => t.property_id === prop.id);
              return (
                <div
                  key={prop.id}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{prop.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {prop.address}
                      </p>
                    </div>
                    <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {propUnits.length} unit{propUnits.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Unit grid */}
                  {propUnits.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {propUnits.map((unit) => {
                        const occupant = propTenants.find(
                          (t) => t.unit_id === unit.id
                        );
                        return (
                          <div
                            key={unit.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border"
                          >
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                unit.status === "Occupied"
                                  ? "bg-emerald-500"
                                  : "bg-amber-400"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">
                                {unit.unit_number}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {occupant ? occupant.full_name : "Vacant"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Maintenance work orders */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Maintenance Work Orders
          </h2>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {mFilters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {f}
                {f !== "All" ? ` (${mCounts[f]})` : ""}
              </button>
            ))}
          </div>

          {filteredM.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No requests"
              description={`No ${activeFilter.toLowerCase()} maintenance requests.`}
            />
          ) : (
            <div className="space-y-3">
              {filteredM.map((req) => (
                <div
                  key={req.id}
                  className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{req.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {req.property_name} · {req.unit_number}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        statusColors[req.status]
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  {req.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {req.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {req.category}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        priorityColors[req.priority]
                      }`}
                    >
                      {req.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* Small reusable stat tile */
function StatTile({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 shadow-sm flex flex-col items-center gap-1 text-center">
      <div className={`p-2 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-base font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
