import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, DoorOpen, CreditCard, Building2, Users, Wrench, Bell } from "lucide-react";

import { supabase } from "@/lib/supabase";

const landlordNav = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Properties", icon: Building2, path: "/properties" },
  { label: "Tenants", icon: Users, path: "/tenants" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Repairs", icon: Wrench, path: "/maintenance" },
  { label: "Notices", icon: Bell, path: "/notices" },
];

const tenantNav = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "My Unit", icon: DoorOpen, path: "/tenant/unit" },
  { label: "Payments", icon: CreditCard, path: "/tenant/payments" },
  { label: "Repairs", icon: Wrench, path: "/tenant/maintenance" },
];

import { useAuth } from "@/lib/AuthContext";

export default function MobileNav() {
  const location = useLocation();
  const { profile, demoRole, user } = useAuth();
  
  const isTenant = demoRole === "tenant" || profile?.role === "tenant";
  const navItems = isTenant ? tenantNav : landlordNav;
  const [pendingNoticesCount, setPendingNoticesCount] = useState(0);
  const [isInactiveTenant, setIsInactiveTenant] = useState(false);

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
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
                {item.label === "Notices" && pendingNoticesCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white leading-none shadow-sm">
                    {pendingNoticesCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}