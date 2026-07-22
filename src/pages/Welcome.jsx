import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { 
  Building2, ShieldCheck, Users,
  CheckCircle, Play, Mail, Info, Wallet, LogIn
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const rolesConfig = {
  agent: {
    title: "Property Agent / Admin",
    icon: ShieldCheck,
    color: "from-indigo-500 to-purple-600",
    text: "indigo-400",
    features: [
      "Add and manage properties & units",
      "Manage tenant details & check-ins",
      "Create leases and set deposit ledgers",
      "Record payments & review automated invoices",
      "Disburse landlord payouts & manage caretakers",
    ],
  },
  landlord: {
    title: "Property Owner / Landlord",
    icon: Wallet,
    color: "from-emerald-500 to-teal-600",
    text: "emerald-400",
    features: [
      "High-level financial & occupancy analytics",
      "View rent collection rates & payout history",
      "Inspect owned property assets & units",
      "Request disbursements/payouts from agents",
    ],
  },
  caretaker: {
    title: "On-Site Caretaker",
    icon: Users,
    color: "from-amber-500 to-orange-600",
    text: "amber-400",
    features: [
      "Oversee physical property operations",
      "View occupant lists per unit",
      "Manage maintenance work orders",
      "Coordinate repair contractors",
    ],
  },
  tenant: {
    title: "Resident / Tenant",
    icon: Building2,
    color: "from-sky-500 to-blue-600",
    text: "sky-400",
    features: [
      "Access private tenant portal",
      "View active lease details & deposit status",
      "Review and pay monthly invoices online",
      "Submit & track maintenance repair requests",
    ],
  },
};

export default function Welcome() {
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("agent");

  // If already authenticated with a real session, skip welcome
  useEffect(() => {
    let isDemo = false;
    try {
      isDemo = localStorage.getItem("demo_role") || localStorage.getItem("demo_user");
    } catch (e) {
      console.warn("localStorage is not accessible", e);
    }
    if (isAuthenticated && !isDemo) {
      navigate("", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLaunchDemo = (role) => {
    // Clear any existing session and wipe mock DB so every demo starts fresh
    signOut().then(() => {
      try {
        localStorage.removeItem("apartabase_mock_db"); // force fresh seed on next load
        localStorage.setItem("demo_role", role);
      } catch (e) {
        console.warn("localStorage is not accessible", e);
      }
      toast({
        title: `Launching ${role.charAt(0).toUpperCase() + role.slice(1)} Demo`,
        description: "Entering sandbox mode. No real data is affected.",
      });
      window.location.href = "/";
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent font-outfit">
              ApartaBase
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 max-w-2xl mx-auto py-4">
          <h1 className="text-4xl md:text-5xl font-extrabold font-outfit tracking-tight leading-[1.15] bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            ApartaBase Property Management Platform
          </h1>
          <p className="text-base text-slate-400 leading-relaxed">
            Apartabase is a modern property administration system with dedicated portals 
            for agents, landlords, caretakers, and tenants. Explore the system live, request a signup invite, or try role-based demos.
          </p>
        </section>

        {/* Explore Tabs System */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold font-outfit">How ApartaBase Works</h2>
            <p className="text-xs text-slate-400">Select a role below to explore features and launch its interactive demo.</p>
          </div>

          {/* Role selector tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(rolesConfig).map(([key, config]) => {
              const Icon = config.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all duration-200 ${
                    isActive 
                      ? "bg-slate-800/80 border-slate-700/80 text-white shadow-sm" 
                      : "bg-slate-950/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? `text-indigo-400` : "text-slate-500"}`} />
                  <span className="capitalize">{key}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Panel */}
          <div className="bg-slate-950/60 border border-slate-900/80 rounded-2xl p-6 grid md:grid-cols-5 gap-6 items-center">
            <div className="md:col-span-3 space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">Active View</span>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {rolesConfig[activeTab].title}
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-300">
                {rolesConfig[activeTab].features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2 flex flex-col items-center justify-center p-4 border-t md:border-t-0 md:border-l border-slate-900/80 gap-4">
              <p className="text-xs text-center text-slate-400 max-w-[200px]">
                Ready to preview this dashboard with real interactive data?
              </p>
              <Button 
                onClick={() => handleLaunchDemo(activeTab)}
                className={`w-full py-5 rounded-xl font-bold text-xs bg-gradient-to-r ${rolesConfig[activeTab].color} hover:brightness-110 shadow-lg transition-all duration-200`}
              >
                <Play className="w-3.5 h-3.5 mr-2 fill-current" /> Launch {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Demo
              </Button>
            </div>
          </div>
        </section>

        {/* Access Info Section */}
        <section className="bg-slate-900/30 border border-slate-900/80 rounded-3xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <Mail className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 space-y-1.5">
              <h2 className="text-base font-bold font-outfit">Getting Real Access</h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                ApartaBase is a private, invite-only platform. Access is granted exclusively by your property agent who sends a secure registration link directly to your email. There is no self-signup.
              </p>
            </div>
            <div className="flex items-center gap-2 p-3.5 bg-slate-950/80 border border-slate-900 rounded-xl text-xs text-slate-400 shrink-0">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Already invited? <button onClick={() => navigate("/login")} className="text-indigo-400 font-semibold hover:underline underline-offset-2">Sign in here →</button></span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/60 bg-slate-950/40 py-10 mt-16 text-center text-xs text-slate-600">
        <p>© 2026 ApartaBase. Premium Property Management Suite.</p>
      </footer>
    </div>
  );
}
