import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageHeader({ title, subtitle, backPath, action }) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-40 bg-primary text-primary-foreground">
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {backPath && (
              <button
                onClick={() => navigate(backPath)}
                className="shrink-0 p-1 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs text-primary-foreground/70 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  );
}