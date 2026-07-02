import React from "react";
import { Outlet } from "react-router-dom";
import MobileNav from "./MobileNav";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <MobileNav />
    </div>
  );
}