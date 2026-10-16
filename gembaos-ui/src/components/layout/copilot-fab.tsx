"use client";

import { Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";

export function CopilotFab() {
  const { copilotOpen, setCopilotOpen } = useAppStore();

  // Hide the FAB when the drawer is open so it never overlaps the chat input bar
  if (copilotOpen) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 tooltip tooltip-left" data-tip="Ask GembaOS (⌘K)">
      {/* Outer subtle radar ping animation */}
      <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping pointer-events-none" />

      {/* Larger, animated primary floating button */}
      <button
        type="button"
        onClick={() => setCopilotOpen(true)}
        className="relative btn btn-primary btn-circle btn-lg w-14 h-14 shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 group"
        aria-label="Ask GembaOS"
      >
        <Sparkles className="w-7 h-7 text-primary-content animate-pulse group-hover:rotate-12 transition-transform duration-300" />
      </button>
    </div>
  );
}
