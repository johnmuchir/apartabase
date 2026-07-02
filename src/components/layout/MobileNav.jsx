import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, DoorOpen, CreditCard, Building2, Users, Wrench, Bell } from "lucide-react";

const landlordNav = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Properties", icon: Building2, path: "/properties" },
  { label: "Tenants", icon: Users, path: "/tenants" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Repairs", icon: Wrench, path: "/maintenance" },
  { label: "Reminders", icon: Bell, path: "/reminders" },
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
  const { profile, demoRole } = useAuth();
  
  const isTenant = demoRole === "tenant" || profile?.role === "tenant";
  const navItems = isTenant ? tenantNav : landlordNav;

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
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
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