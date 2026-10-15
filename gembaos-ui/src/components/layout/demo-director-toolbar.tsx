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
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 transition-all duration-200">
      <div className="bg-base-200/95 border border-base-300 backdrop-blur-md rounded-2xl shadow-2xl px-3.5 py-1.5 flex items-center gap-2.5 text-xs">
        {/* Title badge */}
        <div className="flex items-center gap-1.5 font-semibold text-base-content border-r border-base-300 pr-2.5 shrink-0">
          <Sliders className="w-3.5 h-3.5 text-primary" />
          <span>Demo Director</span>
        </div>

        {!collapsed && (
          <div className="flex items-center gap-2">
            {/* Scenario 1 */}
            <button
              disabled={loading !== null}
              onClick={() => handleTrigger("bearing_failure_cnc07", "CNC-07 Bearing Breach")}
              className={cn(
                "btn btn-xs gap-1.5 rounded-lg border",
                activeScenario === "bearing_failure_cnc07"
                  ? "btn-error text-white"
                  : "btn-ghost border-base-300 text-base-content hover:border-red-400/50"
              )}
            >
              <AlertOctagon className="w-3 h-3 text-red-400" />
              <span>Bearing Fault (CNC-07)</span>
            </button>

            {/* Scenario 2 */}
            <button
              disabled={loading !== null}
              onClick={() => handleTrigger("typhoon_hsinchu", "Typhoon Haikui-2")}
              className={cn(
                "btn btn-xs gap-1.5 rounded-lg border",
                activeScenario === "typhoon_hsinchu"
                  ? "btn-warning text-white"
                  : "btn-ghost border-base-300 text-base-content hover:border-warning/50"
              )}
            >
              <CloudLightning className="w-3 h-3 text-yellow-400" />
              <span>Typhoon Haikui-2</span>
            </button>

            {/* Reset */}
            <button
              disabled={loading !== null}
              onClick={handleReset}
              className="btn btn-ghost btn-xs gap-1 rounded-lg text-base-content/60 hover:text-base-content border border-base-300"
              title="Reset asset wear and clear active alerts"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset State</span>
            </button>

            {/* Status confirmation */}
            {message && (
              <span className="text-[11px] font-mono text-primary animate-pulse ml-1 truncate max-w-48">
                {message}
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn btn-ghost btn-xs p-1 text-base-content/50 hover:text-base-content"
          title={collapsed ? "Expand Demo Director" : "Collapse Demo Director"}
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
