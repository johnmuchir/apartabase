import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { entities } from "@/api/supabaseClient";
import { MapPin, DoorOpen, Building2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

export default function PublicUnit() {
  const { id } = useParams();
  const [unit, setUnit] = useState(null);
  const [property, setProperty] = useState(null);
  const [lease, setLease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const u = await entities.Unit.get(id);
        setUnit(u);
        const [prop, leases] = await Promise.all([
          entities.Property.get(u.property_id),
          entities.Lease.filter({ unit_id: id }),
        ]);
        setProperty(prop);
        setLease(leases.find((l) => l.unit_id === id) || null);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    const text = `🏠 ${property?.name || "Property"} — Unit ${unit.unit_number} (${unit.unit_type}) available for ${formatKES(unit.monthly_rent)}/mo in ${property?.location || ""}.`;
    if (navigator.share) {
      try { await navigator.share({ title: "Unit available", text, url }); } catch (e) { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast({ title: "Link copied" });
      } catch (e) {
        toast({ title: "Copy failed", variant: "destructive" });
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (error || !unit) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <Building2 className="w-10 h-10 text-muted-foreground mb-3" />
      <h1 className="text-lg font-semibold">Listing not found</h1>
      <p className="text-sm text-muted-foreground mt-1">This unit may no longer be available.</p>
    </div>
  );

  const isVacant = unit.status === "Vacant";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto">
        {property?.image_url ? (
          <img src={property.image_url} alt={property.name} className="w-full h-56 object-cover" />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Building2 className="w-12 h-12 text-primary/40" />
          </div>
        )}

        <div className="px-4 py-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isVacant ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {isVacant ? "Available" : "Occupied"}
              </span>
            </div>
            <h1 className="text-xl font-bold">{property?.name || "Property"}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {property?.location}{property?.address ? ` · ${property.address}` : ""}
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Unit {unit.unit_number}</span>
              </div>
              <span className="text-xs text-muted-foreground">{unit.unit_type}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Monthly Rent</p>
                <p className="text-base font-bold">{formatKES(unit.monthly_rent)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Deposit</p>
                <p className="text-base font-bold">{formatKES(lease?.deposit)}</p>
              </div>
            </div>
          </div>

          <Button className="w-full h-12" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" /> Share this listing
          </Button>
        </div>
      </div>
    </div>
  );
}