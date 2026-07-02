import React, { useState, useEffect } from "react";
import { loadDemoTenant } from "@/lib/demoTenant";
import { DoorOpen, Phone, Calendar, Home, User as UserIcon } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

export default function TenantUnit() {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { tenant: t } = await loadDemoTenant();
        if (t) setTenant(t);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (<><PageHeader title="My Unit" backPath="/" /><LoadingSpinner /></>);
  if (!tenant) {
    return (
      <div>
        <PageHeader title="My Unit" backPath="/" />
        <p className="text-center py-16 text-sm text-muted-foreground">No tenant profile found.</p>
      </div>
    );
  }

  const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

  const details = [
    { icon: Home, label: "Property", value: tenant.property_name },
    { icon: DoorOpen, label: "Unit Number", value: tenant.unit_number },
    { icon: DoorOpen, label: "Unit Type", value: tenant.unit_type || "—" },
    { icon: Calendar, label: "Monthly Rent", value: formatKES(tenant.monthly_rent) },
    { icon: Calendar, label: "Lease Start", value: tenant.lease_start || "—" },
    { icon: Calendar, label: "Lease End", value: tenant.lease_end || "—" },
    { icon: Phone, label: "Phone", value: tenant.phone },
    { icon: UserIcon, label: "ID Number", value: tenant.id_number || "—" },
  ];

  return (
    <div>
      <PageHeader title="My Unit" subtitle={tenant.property_name} backPath="/" />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="bg-primary text-primary-foreground rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/10">
              <DoorOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-primary-foreground/70">Your Unit</p>
              <h2 className="text-xl font-bold">{tenant.unit_number}</h2>
              <p className="text-xs text-primary-foreground/80 mt-0.5">{tenant.unit_type}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
          {details.map((d, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <d.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-sm font-medium truncate">{d.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}