import React from "react";
import { User, Wrench, ChevronDown, History } from "lucide-react";

export default function UnitHistoryCard({ unit, tenants, maintenanceReqs }) {
  const unitTenants = tenants.filter((t) => t.unit_id === unit.id);
  const currentTenant = unitTenants.find((t) => t.status === "Active");
  const previousTenants = unitTenants.filter((t) => t.status !== "Active");
  const completedTasks = maintenanceReqs.filter((m) => m.unit_id === unit.id && m.status === "Completed");

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-4">
      {/* Tenant history */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <History className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tenant History</h4>
        </div>
        {unitTenants.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tenant records for this unit.</p>
        ) : (
          <div className="space-y-2">
            {currentTenant && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-medium">{currentTenant.full_name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(currentTenant.lease_start)} – present
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ml-auto">Current</span>
              </div>
            )}
            {previousTenants.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                <span className="text-xs">{t.full_name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(t.lease_start)} – {formatDate(t.lease_end)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed maintenance */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completed Repairs</h4>
        </div>
        {completedTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No completed maintenance tasks.</p>
        ) : (
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{task.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {task.category} · {formatDate(task.created_date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}