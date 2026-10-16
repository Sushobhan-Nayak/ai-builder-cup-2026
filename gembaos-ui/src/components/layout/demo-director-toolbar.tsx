"use client";
import { useState } from "react";
import { Play, RotateCcw, AlertOctagon, CloudLightning, Sliders, ChevronDown, ChevronUp } from "lucide-react";
import { triggerDemoScenario, resetDemo } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export function DemoDirectorToolbar() {
  const { setActiveScenario, activeScenario } = useAppStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleTrigger = async (key: string, name: string) => {
    setLoading(key);
    setMessage(`Triggering ${name}…`);
    try {
      await triggerDemoScenario(key);
      setActiveScenario(key);
      setMessage(`Active: ${name} (Disruption injected)`);
    } catch (err) {
      console.warn("Demo scenario error:", err);
      setActiveScenario(key);
      setMessage(`Active: ${name}`);
    } finally {
      setLoading(null);
    }
  };

  const handleReset = async () => {
    setLoading("reset");
    setMessage("Resetting demo state…");
    try {
      await resetDemo();
      setActiveScenario(null);
      setMessage("Demo state reset to clean baseline.");
    } catch (err) {
      console.warn("Reset demo error:", err);
      setActiveScenario(null);
      setMessage("Demo state reset.");
    } finally {
      setLoading(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 pointer-events-auto">
      <div className="relative bg-[#0b1324]/95 border-2 border-cyan-500/40 backdrop-blur-xl rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_22px_rgba(6,182,212,0.25)] px-3.5 py-1.5 flex items-center gap-2.5 text-xs before:absolute before:inset-x-8 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-cyan-400/80 before:to-transparent">
        {/* Title badge */}
        <div className="flex items-center gap-1.5 font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-1 rounded-xl shrink-0 shadow-sm">
          <Sliders className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="tracking-wide">Demo Director</span>
        </div>

        {!collapsed && (
          <div className="flex items-center gap-2">
            {/* Scenario 1 */}
            <button
              disabled={loading !== null}
              onClick={() => handleTrigger("bearing_failure_cnc07", "CNC-07 Bearing Breach")}
              className={cn(
                "btn btn-xs gap-1.5 rounded-xl border font-semibold transition-all shadow-sm",
                activeScenario === "bearing_failure_cnc07"
                  ? "btn-error text-white shadow-red-500/40"
                  : "bg-red-950/40 border-red-500/40 text-red-200 hover:bg-red-900/60 hover:text-white hover:border-red-400"
              )}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
              <span>Bearing Fault (CNC-07)</span>
            </button>

            {/* Scenario 2 */}
            <button
              disabled={loading !== null}
              onClick={() => handleTrigger("typhoon_hsinchu", "Typhoon Haikui-2")}
              className={cn(
                "btn btn-xs gap-1.5 rounded-xl border font-semibold transition-all shadow-sm",
                activeScenario === "typhoon_hsinchu"
                  ? "btn-warning text-black font-bold shadow-yellow-500/40"
                  : "bg-amber-950/40 border-amber-500/40 text-amber-200 hover:bg-amber-900/60 hover:text-white hover:border-amber-400"
              )}
            >
              <CloudLightning className="w-3.5 h-3.5 text-yellow-400" />
              <span>Typhoon Haikui-2</span>
            </button>

            {/* Reset */}
            <button
              disabled={loading !== null}
              onClick={handleReset}
              className="btn btn-xs gap-1.5 rounded-xl bg-[#1e293b]/90 hover:bg-[#334155] border border-[#475569] text-[#e2e8f0] hover:text-white shadow-sm"
              title="Reset asset wear and clear active alerts"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Reset State</span>
            </button>

            {/* Status confirmation */}
            {message && (
              <span className="text-[11px] font-mono text-cyan-300 font-medium animate-pulse ml-1 truncate max-w-52">
                {message}
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn btn-ghost btn-xs p-1 text-cyan-400 hover:text-white hover:bg-cyan-950/50 rounded-lg"
          title={collapsed ? "Expand Demo Director" : "Collapse Demo Director"}
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
