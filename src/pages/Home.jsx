import React, { useState, useEffect } from "react";
import AgentDashboard from "@/pages/AgentDashboard";
import LandlordDashboard from "@/pages/LandlordDashboard";
import TenantDashboard from "@/pages/TenantDashboard";
import CaretakerDashboard from "@/pages/CaretakerDashboard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    setRole(localStorage.getItem("demo_role") || "landlord");
    setLoading(false);
  }, []);

  if (loading) return <LoadingSpinner />;

  if (role === "tenant") return <TenantDashboard />;
  if (role === "agent") return <AgentDashboard />;
  if (role === "caretaker") return <CaretakerDashboard />;
  return <LandlordDashboard />;
}