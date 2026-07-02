import React, { useState, useRef } from "react";
import { FileText, FileCheck } from "lucide-react";
import { entities, integrations } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const formatKES = (n) => `KES ${(n || 0).toLocaleString()}`;

export default function UnitLeaseCard({ unit, leases, onLeaseUpdated }) {
  const lease = leases.find((l) => l.unit_id === unit.id);
  const { toast } = useToast();
  const [afterFile, setAfterFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleAfterUpload = async () => {
    if (!afterFile || !lease) return;
    setUploading(true);
    try {
      const { url } = await integrations.Core.UploadFile({ file: afterFile });
      await entities.Lease.update(lease.id, { inspection_after_url: url });
      onLeaseUpdated?.(lease.id, { inspection_after_url: file_url });
      toast({ title: "After-inspection uploaded" });
      setAfterFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!lease) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 mb-1">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lease</h4>
        </div>
        <p className="text-xs text-muted-foreground">No lease on record for this unit.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <div className="flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lease</h4>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Monthly Rent</p>
          <p className="font-semibold">{formatKES(lease.monthly_rent)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Deposit</p>
          <p className="font-semibold">{formatKES(lease.deposit)}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {lease.lease_agreement_url && (
          <a href={lease.lease_agreement_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
            <FileCheck className="w-3.5 h-3.5" /> Lease Agreement
          </a>
        )}
        {lease.inspection_before_url && (
          <a href={lease.inspection_before_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
            <FileCheck className="w-3.5 h-3.5" /> Inspection Report (Before)
          </a>
        )}
        {lease.inspection_after_url ? (
          <a href={lease.inspection_after_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
            <FileCheck className="w-3.5 h-3.5" /> Inspection Report (After)
          </a>
        ) : (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setAfterFile(e.target.files?.[0])} className="text-[10px] flex-1" />
            <Button size="sm" className="h-7 text-[10px]" onClick={handleAfterUpload} disabled={!afterFile || uploading}>
              {uploading ? "Uploading..." : "Upload After"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}