import React from "react";
import { ArrowLeft, User, Settings, LogOut, ChevronDown } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function PageHeader({ title, subtitle, backPath, action }) {
  const navigate = useNavigate();
  const { isAuthenticated, profile, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : profile?.email ? profile.email[0].toUpperCase() : "U";

  return (
    <div className="sticky top-0 z-40 bg-primary text-primary-foreground">
      <div className="max-w-lg mx-auto px-4 py-3">
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
              <h1 className="text-base font-bold tracking-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-[10px] text-primary-foreground/70 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {action && <div>{action}</div>}
            
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 p-1 rounded-lg hover:bg-white/10 transition-colors focus:outline-none">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white border border-white/10 uppercase shrink-0">
                      {initials}
                    </div>
                    <ChevronDown className="w-3 h-3 text-primary-foreground/80 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none text-foreground truncate">
                        {profile?.full_name || "User"}
                      </p>
                      <p className="text-[10px] leading-none text-muted-foreground truncate">
                        {profile?.email || ""}
                      </p>
                      <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary w-fit mt-1">
                        {profile?.role || "Tenant"}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex w-full items-center gap-2 cursor-pointer">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <span>Profile Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="flex w-full items-center gap-2 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}