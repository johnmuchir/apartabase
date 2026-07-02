import React from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function ShareUnitButton({ unit, property }) {
  const { toast } = useToast();

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${unit.id}`;
    const rent = (unit.monthly_rent || 0).toLocaleString();
    const text = `🏠 ${property?.name || "Property"} — Unit ${unit.unit_number} (${unit.unit_type}) now available for KES ${rent}/mo in ${property?.location || ""}. View details: ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Unit ${unit.unit_number} available`, text, url });
      } catch (e) { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "Listing copied to clipboard" });
      } catch (e) {
        toast({ title: "Copy failed", variant: "destructive" });
      }
    }
  };

  return (
    <Button size="sm" variant="outline" className="w-full" onClick={handleShare}>
      <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share Vacant Unit
    </Button>
  );
}