import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

// Layouts
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

// Public Pages & Auth
import Login from "@/pages/Login";
import AcceptInvite from "@/pages/AcceptInvite";
import ResetPassword from "@/pages/ResetPassword";
import PublicUnit from "@/pages/PublicUnit";
import PageNotFound from "@/lib/PageNotFound";

// Dashboards
import Dashboard from "@/pages/Dashboard"; // Landlord Overview
import LandlordDashboard from "@/pages/LandlordDashboard"; // My Property (Linked Landlord)
import AgentDashboard from "@/pages/AgentDashboard"; // Agent Overview
import TenantDashboard from "@/pages/TenantDashboard"; // Tenant Overview

// Landlord/Agent Pages
import Properties from "@/pages/Properties";
import PropertyDetail from "@/pages/PropertyDetail";
import Units from "@/pages/Units";
import Tenants from "@/pages/Tenants";
import Payments from "@/pages/Payments";
import AgentMaintenance from "@/pages/AgentMaintenance";
import RentReminders from "@/pages/RentReminders";

// Tenant Pages
import TenantUnit from "@/pages/TenantUnit";
import TenantPayments from "@/pages/TenantPayments";
import TenantMaintenance from "@/pages/TenantMaintenance";

function HomeRedirect() {
  const { profile, demoRole } = useAuth();
  const role = demoRole || profile?.role || "tenant";

  if (role === "agent") {
    return <AgentDashboard />;
  }
  if (role === "landlord") {
    // If landlord has a linked property, they use LandlordDashboard. Otherwise Dashboard.
    return <Dashboard />;
  }
  if (role === "caretaker") {
    return <LandlordDashboard />;
  }
  return <TenantDashboard />;
}

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/public/unit/:id" element={<PublicUnit />} />

      {/* Protected App Routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          {/* Dashboard Hub */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Landlord/Agent Routes */}
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/units" element={<Units />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/maintenance" element={<AgentMaintenance />} />
          <Route path="/reminders" element={<RentReminders />} />

          {/* Tenant Routes */}
          <Route path="/tenant/unit" element={<TenantUnit />} />
          <Route path="/tenant/payments" element={<TenantPayments />} />
          <Route path="/tenant/maintenance" element={<TenantMaintenance />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}
