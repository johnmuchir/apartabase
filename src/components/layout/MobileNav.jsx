import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, DoorOpen, CreditCard, Building2, Users,
  Wrench, Bell, Wallet, MoreHorizontal, Settings
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

const landlordNav = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Properties", icon: Building2, path: "/properties" },
  { label: "Tenants", icon: Users, path: "/tenants" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "More", icon: MoreHorizontal, path: "#more", isMore: true },
];

const tenantNav = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "My Unit", icon: DoorOpen, path: "/tenant/unit" },
  { label: "Payments", icon: CreditCard, path: "/tenant/payments" },
  { label: "Repairs", icon: Wrench, path: "/tenant/maintenance" },
];

export default function MobileNav() {
  const location = useLocation();
  const { profile, demoRole, user } = useAuth();
  
  const isTenant = demoRole === "tenant" || profile?.role === "tenant";
  const navItems = isTenant ? tenantNav : landlordNav;
  const [pendingNoticesCount, setPendingNoticesCount] = useState(0);
  const [isInactiveTenant, setIsInactiveTenant] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!isTenant) {
      loadPendingNotices();
    } else if (user) {
      checkTenantStatus();
    }
  }, [isTenant, user, location.pathname]);

  const loadPendingNotices = async () => {
    try {
      const { count, error } = await supabase
        .from("vacate_notices")
        .select("id", { count: "exact", head: true })
        .eq("status", "Pending");
      if (!error) {
        setPendingNoticesCount(count || 0);
      }
    } catch (e) {
      console.error("Error loading pending notices count in nav:", e);
    }
  };

  const checkTenantStatus = async () => {
    try {
      let { data: tenantData } = await supabase
        .from("tenants")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "Active")
        .maybeSingle();

      if (!tenantData) {
        const { data: activeByEmail } = await supabase
          .from("tenants")
          .select("status")
          .eq("email", user.email)
          .eq("status", "Active")
          .limit(1);

        if (activeByEmail && activeByEmail.length > 0) {
          setIsInactiveTenant(false);
        } else {
          const { data: anyProfile } = await supabase
            .from("tenants")
            .select("status")
            .eq("email", user.email)
            .order("created_date", { ascending: false })
            .limit(1);

          if (anyProfile && anyProfile.length > 0 && anyProfile[0].status === "Inactive") {
            setIsInactiveTenant(true);
          }
        }
      } else {
        setIsInactiveTenant(false);
      }
    } catch (e) {
      console.error("Error checking tenant status in nav:", e);
    }
  };

  if (isTenant && isInactiveTenant) {
    return null;
  }

  const isMoreActive = ["/payouts", "/maintenance", "/notices", "/settings"].some(
    (path) => location.pathname === path || location.pathname.startsWith(path)
  );

  return (
    <>
      {/* Backdrop overlay for More menu */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* Slide-up sheet for collapsed More items */}
      <div
        className={`fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-border rounded-t-2xl shadow-xl p-4 max-w-lg mx-auto transition-all duration-300 ease-out transform ${
          showMore ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex justify-between items-center pb-3 border-b border-border/60 mb-4">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">More Menu</span>
          <button
            onClick={() => setShowMore(false)}
            className="text-[11px] text-muted-foreground font-semibold px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
          >
            Close
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4 py-2">
          <Link
            to="/payouts"
            onClick={() => setShowMore(false)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium text-foreground">Payouts</span>
          </Link>
          <Link
            to="/maintenance"
            onClick={() => setShowMore(false)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
              <Wrench className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium text-foreground">Repairs</span>
          </Link>
          <Link
            to="/notices"
            onClick={() => setShowMore(false)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/40 transition-colors relative"
          >
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <Bell className="w-5 h-5" />
              {pendingNoticesCount > 0 && (
                <span className="absolute top-1.5 right-4 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white shadow-sm">
                  {pendingNoticesCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium text-foreground">Notices</span>
          </Link>
          <Link
            to="/settings"
            onClick={() => setShowMore(false)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium text-foreground">Settings</span>
          </Link>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
          {navItems.map((item) => {
            const isActive = item.isMore
              ? isMoreActive
              : location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));

            if (item.isMore) {
              return (
                <button
                  key={item.path}
                  onClick={() => setShowMore(!showMore)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors relative ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="relative">
                    <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                    {pendingNoticesCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white leading-none shadow-sm">
                        {pendingNoticesCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors relative ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="relative">
                  <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                </div>
                <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}