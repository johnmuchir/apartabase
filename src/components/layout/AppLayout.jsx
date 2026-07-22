import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { LogOut } from "lucide-react";
import MobileNav from "./MobileNav";

export default function AppLayout() {
  const { demoRole, signOut } = useAuth();

  const handleExitDemo = async () => {
    await signOut();
    window.location.href = "/welcome";
  };

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col">
      {demoRole && (
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-650 text-white shadow-md text-xs font-semibold px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Interactive Demo Sandbox ({demoRole.toUpperCase()})</span>
          </div>
          <button 
            onClick={signOut}
            className="flex items-center text-red-600 gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
          >
            <LogOut className="w-3 h-3 text-red-300" /> Exit Demo
          </button>
        </div>
      )}
      <div className="flex-1 w-full">
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
}