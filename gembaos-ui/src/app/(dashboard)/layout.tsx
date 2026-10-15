"use client";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { CopilotDrawer } from "@/components/layout/copilot-drawer";
import { DemoDirectorToolbar } from "@/components/layout/demo-director-toolbar";
import { useAppStore } from "@/store/app-store";
import { Suspense, useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { setCopilotOpen } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCopilotOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCopilotOpen]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<aside className="w-56 h-screen bg-base-200 border-r border-base-300 shrink-0" />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-col flex-1 min-w-0">
        <Suspense fallback={<div className="min-h-12 bg-base-200 border-b border-base-300" />}>
          <TopBar />
        </Suspense>
        <main className="flex-1 overflow-y-auto bg-base-100">
          <Suspense fallback={<div className="p-6 text-sm text-base-content/40">Loading view…</div>}>
            {children}
          </Suspense>
        </main>
      </div>
      <CopilotDrawer />
      <DemoDirectorToolbar />
    </div>
  );
}
