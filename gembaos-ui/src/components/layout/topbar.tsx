"use client";
import {
  Bell,
  Play,
  Square,
  CheckCircle,
  XCircle,
  Scale,
  Radio,
  ChevronRight,
  Sliders,
  AlertOctagon,
  CloudLightning,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  fetchPlants,
  fetchDecisions,
  approveDecision,
  rejectDecision,
  fetchActiveInsights,
  triggerDemoScenario,
  resetDemo,
  type DecisionItem,
  type InsightItem,
  type PlantInfo,
} from "@/lib/api-client";

function DecisionDropdown() {
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { selectedPlant, setPendingDecisions } = useAppStore();

  useEffect(() => {
    let mounted = true;
    fetchDecisions("pending").then((data) => {
      if (mounted) {
        setDecisions(data);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredDecisions = selectedPlant === "ALL"
    ? decisions
    : decisions.filter((d) => !d.plant_ids || d.plant_ids.length === 0 || d.plant_ids.includes(selectedPlant));

  const pending = filteredDecisions.filter((d) => d.status === "pending").length;

  useEffect(() => {
    setPendingDecisions(pending);
  }, [pending, setPendingDecisions]);

  const handleApprove = async (id: string) => {
    setLoading(true);
    try {
      await approveDecision(id, { option_id: "OPT-A", comment: "Approved via TopBar Decision Inbox" });
      setDecisions((prev) =>
        prev.map((d) => (d.id === id || d.decision_id === id ? { ...d, status: "approved" } : d))
      );
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setLoading(true);
    try {
      await rejectDecision(id, { reason: "Rejected via TopBar Decision Inbox" });
      setDecisions((prev) =>
        prev.map((d) => (d.id === id || d.decision_id === id ? { ...d, status: "rejected" } : d))
      );
    } catch (err) {
      console.error("Reject failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dropdown dropdown-bottom dropdown-start">
      <button
        tabIndex={0}
        className={cn(
          "h-8 px-3 rounded-lg border flex items-center gap-2 text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 shadow-sm",
          pending > 0
            ? "border-amber-500/70 bg-gradient-to-r from-amber-950/60 to-yellow-950/40 text-amber-200 hover:bg-amber-900/60 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse"
            : "border-amber-500/50 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40 shadow-[0_0_10px_rgba(245,158,11,0.25)] animate-pulse"
        )}
      >
        <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="whitespace-nowrap font-medium">Decision Inbox</span>
        {pending > 0 && (
          <span className="relative flex items-center">
            <span className="absolute -inset-0.5 rounded-full bg-amber-500/60 animate-ping pointer-events-none" />
            <span className="relative px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-amber-500 text-slate-950 shadow-xs">
              {pending}
            </span>
          </span>
        )}
      </button>

      <div tabIndex={0} className="dropdown-content z-50 mt-1 w-80 bg-base-200 border border-base-300 rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <span className="text-xs font-semibold text-base-content/60 uppercase tracking-widest">Decision Inbox</span>
          {pending > 0 && <span className="text-xs text-warning">{pending} pending</span>}
        </div>
        <div className="divide-y divide-base-300 max-h-96 overflow-y-auto">
          {filteredDecisions.length === 0 ? (
            <div className="p-4 text-xs text-base-content/40 text-center">No pending decisions for this plant</div>
          ) : (
            filteredDecisions.map((dec) => {
              const id = dec.id || dec.decision_id || "";
              return (
                <div key={id} className={cn("px-4 py-3 transition-colors", dec.status !== "pending" && "opacity-40")}>
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                        dec.severity === "critical"
                          ? "bg-error"
                          : dec.severity === "high"
                          ? "bg-warning"
                          : "bg-primary"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-base-content">{dec.title}</p>
                      <p className="text-[11px] text-base-content/40 mt-0.5">{dec.recommendation}</p>
                      {dec.impact?.usd_benefit > 0 && (
                        <p className="text-[10px] text-success mt-0.5">
                          +${(dec.impact.usd_benefit / 1000).toFixed(0)}k protected
                        </p>
                      )}
                    </div>
                  </div>
                  {dec.status === "pending" && (
                    <div className="flex gap-2 mt-2.5 ml-4">
                      <button
                        disabled={loading}
                        onClick={() => handleApprove(id)}
                        className="btn btn-success btn-outline btn-xs flex-1 gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => handleReject(id)}
                        className="btn btn-error btn-outline btn-xs flex-1 gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  )}
                  {dec.status === "approved" && (
                    <p className="text-[11px] text-success mt-1 ml-4 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Approved
                    </p>
                  )}
                  {dec.status === "rejected" && (
                    <p className="text-[11px] text-error mt-1 ml-4 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Rejected
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function LiveStreamDropdown() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const { selectedPlant, setActiveAlertsCount } = useAppStore();

  useEffect(() => {
    let mounted = true;
    const poll = () => {
      fetchActiveInsights("new").then((data) => {
        if (mounted && data) {
          setInsights(data);
          setActiveAlertsCount(data.length);
        }
      });
    };
    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setActiveAlertsCount]);

  const filteredInsights = selectedPlant === "ALL"
    ? insights
    : insights.filter(
        (ins) => !ins.plant_ids || ins.plant_ids.length === 0 || ins.plant_ids.includes(selectedPlant)
      );

  const severityDot: Record<string, string> = {
    critical: "bg-[#e05c5c]",
    high: "bg-[#e8a838]",
    medium: "bg-[#e8a838]/60",
    low: "bg-[#5b73ff]",
  };

  return (
    <div className="dropdown dropdown-end">
      <button
        tabIndex={0}
        className={cn(
          "h-8 px-3 rounded-lg border flex items-center gap-2 text-xs font-medium transition-all cursor-pointer shrink-0 shadow-sm relative",
          filteredInsights.length > 0
            ? "border-red-500/70 bg-gradient-to-r from-red-950/60 to-rose-950/40 text-red-200 hover:bg-red-900/60 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
            : "border-red-500/50 bg-red-950/30 text-red-200 hover:bg-red-900/40 shadow-[0_0_10px_rgba(239,68,68,0.25)] animate-pulse"
        )}
        title={`${filteredInsights.length} active alerts — click for Live Stream`}
      >
        <Bell className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="hidden sm:inline text-xs font-medium">Alerts</span>
        {filteredInsights.length > 0 && (
          <span className="relative flex items-center">
            <span className="absolute -inset-0.5 rounded-full bg-red-500/60 animate-ping pointer-events-none" />
            <span className="relative px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-red-600 text-white shadow-xs">
              {filteredInsights.length}
            </span>
          </span>
        )}
      </button>

      <div
        tabIndex={0}
        className="dropdown-content z-50 mt-1 w-96 bg-base-200 border border-base-300 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-300/40">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-success animate-pulse" />
            <span className="text-xs font-semibold text-base-content uppercase tracking-wider">
              Live Event Stream
            </span>
          </div>
          <span className="text-[10px] font-mono text-base-content/70 bg-base-100 px-2 py-0.5 rounded-full border border-base-content/10">
            {filteredInsights.length} active
          </span>
        </div>

        <div className="divide-y divide-base-300 max-h-96 overflow-y-auto">
          {filteredInsights.length === 0 ? (
            <div className="p-6 text-xs text-base-content/40 text-center space-y-1">
              <p className="font-semibold text-base-content/70">All Normal</p>
              <p>No active anomalies across the fleet.</p>
            </div>
          ) : (
            filteredInsights.map((ins) => (
              <Link
                key={ins.id}
                href={ins.domain === "maintenance" ? "/asset-health" : "/war-room"}
                className="flex gap-2.5 px-4 py-3 hover:bg-base-300/60 transition-colors group text-left"
              >
                <div className="mt-1 shrink-0">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full inline-block",
                      severityDot[ins.severity] || "bg-info"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-base-content group-hover:text-primary transition-colors truncate">
                      {ins.title}
                    </span>
                    {ins.id === "ins_002" && (
                      <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-1 rounded font-mono">
                        SCENARIO
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-base-content/60 mt-0.5 line-clamp-2 leading-relaxed">
                    {ins.summary}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-[10px]">
                    <span className="text-base-content/50 font-mono">Agent: {ins.agent}</span>
                    {ins.impact?.usd && ins.impact.usd > 0 ? (
                      <span className="text-warning font-semibold font-mono">
                        ${(ins.impact.usd / 1000).toFixed(0)}k at risk
                      </span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-base-content/30 group-hover:text-primary shrink-0 self-center transition-colors" />
              </Link>
            ))
          )}
        </div>

        <div className="p-2 border-t border-base-300 bg-base-300/30 text-center">
          <Link
            href="/"
            className="text-[11px] text-primary hover:underline font-medium inline-block py-0.5"
          >
            View Command Center →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const {
    selectedPlant,
    setSelectedPlant,
    plants,
    setPlants,
    simRunning,
    setSimRunning,
    activeScenario,
    setActiveScenario,
  } = useAppStore();
  const [simLoading, setSimLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchPlants().then((data) => {
      if (mounted && data?.length) {
        setPlants(data);
      }
    });
    return () => {
      mounted = false;
    };
  }, [setPlants]);

  const handleTriggerScenario = async (key: string, name: string) => {
    setDemoLoading(key);
    setDemoMessage(`Triggering ${name}…`);
    try {
      await triggerDemoScenario(key);
      setActiveScenario(key);
      setDemoMessage(`Active: ${name}`);
    } catch (err) {
      console.warn("Demo scenario error:", err);
      setActiveScenario(key);
      setDemoMessage(`Active: ${name}`);
    } finally {
      setDemoLoading(null);
      setTimeout(() => setDemoMessage(null), 3500);
    }
  };

  const handleResetDemo = async () => {
    setDemoLoading("reset");
    setDemoMessage("Resetting demo…");
    try {
      await resetDemo();
      setActiveScenario(null);
      setDemoMessage("Clean baseline.");
    } catch (err) {
      console.warn("Reset demo error:", err);
      setActiveScenario(null);
      setDemoMessage("Reset.");
    } finally {
      setDemoLoading(null);
      setTimeout(() => setDemoMessage(null), 3000);
    }
  };

  const handleToggleSim = async () => {
    const nextState = !simRunning;
    setSimLoading(true);
    try {
      if (nextState) {
        // Trigger scenario at 60x speed multiplier per API specification
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://gembaos-gateway-100149412472.asia-southeast1.run.app"}/v1/demo/scenarios/bearing_failure_cnc07/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speed_multiplier: 60 }),
        });
      } else {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://gembaos-gateway-100149412472.asia-southeast1.run.app"}/v1/demo/reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.warn("Simulator toggle notice:", e);
    } finally {
      setSimRunning(nextState);
      setSimLoading(false);
    }
  };

  return (
    <div className="navbar bg-[#0a0f1d] border-b border-[#1e293b]/80 min-h-12 h-13 px-4 py-1 gap-3 flex items-center justify-between select-none shadow-sm">
      {/* Left side: Plant switcher & Decision Inbox */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="relative flex items-center">
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="appearance-none h-8 pl-3 pr-8 rounded-lg border border-[#243042] bg-[#121927] hover:border-[#384960] text-xs font-medium text-[#E6EDF3] focus:outline-none focus:border-cyan-500/50 transition-colors cursor-pointer"
          >
            <option value="ALL">🌐 All Plants (Global)</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.flag ? `${p.flag} ` : ""}{p.name} ({p.id})
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#8B98A9] pointer-events-none absolute right-2.5" />
        </div>

        <DecisionDropdown />
      </div>

      {/* Middle: Integrated Demo Director & 60x Sim Controls */}
      <div className="flex items-center gap-1.5 bg-[#0c1424] border border-[#23334d] shadow-[0_2px_12px_rgba(0,0,0,0.4)] rounded-full px-2.5 py-1">
        <div className="flex items-center gap-1.5 font-bold text-cyan-400 text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-800/40 shrink-0 uppercase tracking-wider">
          <Sliders className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span className="hidden sm:inline">Demo Director</span>
        </div>

        {/* Scenario 1: Bearing Fault */}
        <button
          disabled={demoLoading !== null}
          onClick={() => handleTriggerScenario("bearing_failure_cnc07", "CNC-07 Bearing Breach")}
          className={cn(
            "h-7 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer",
            activeScenario === "bearing_failure_cnc07"
              ? "bg-gradient-to-r from-red-600 to-rose-700 text-white font-semibold shadow-[0_0_12px_rgba(239,68,68,0.45)] border border-red-400"
              : "bg-[#181a24] text-red-300/90 border border-red-900/40 hover:bg-red-950/60 hover:border-red-500/50 hover:text-white"
          )}
          title="Trigger Bearing Fault scenario on CNC-07"
        >
          <AlertOctagon className="w-3 h-3 text-red-400" />
          <span className="hidden md:inline">Bearing Fault</span>
          <span className="font-mono text-[10px] opacity-80">(CNC-07)</span>
        </button>

        {/* Scenario 2: Typhoon Haikui-2 */}
        <button
          disabled={demoLoading !== null}
          onClick={() => handleTriggerScenario("typhoon_hsinchu", "Typhoon Haikui-2")}
          className={cn(
            "h-7 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer",
            activeScenario === "typhoon_hsinchu"
              ? "bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-bold shadow-[0_0_12px_rgba(245,158,11,0.45)] border border-amber-300"
              : "bg-[#1c1a17] text-amber-300/90 border border-amber-900/40 hover:bg-amber-950/60 hover:border-amber-500/50 hover:text-white"
          )}
          title="Trigger Typhoon Haikui-2 disruption"
        >
          <CloudLightning className="w-3 h-3 text-amber-400" />
          <span>Typhoon Haikui-2</span>
        </button>

        {/* Reset State */}
        <button
          disabled={demoLoading !== null}
          onClick={handleResetDemo}
          className="h-7 px-2.5 rounded-full text-xs text-[#8B98A9] hover:text-[#E6EDF3] bg-transparent hover:bg-[#1A2333] border border-transparent hover:border-[#243042] flex items-center gap-1 transition-all cursor-pointer"
          title="Reset demo state to baseline"
        >
          <RotateCcw className="w-3 h-3 text-cyan-400" />
          <span className="hidden lg:inline text-[11px] font-medium">Reset</span>
        </button>

        <div className="h-4 w-px bg-[#23334d] mx-0.5" />

        {/* Sim control - Triggers 60x telemetry simulator */}
        <button
          disabled={simLoading}
          onClick={handleToggleSim}
          className={cn(
            "h-7 px-3 gap-1.5 transition-all rounded-full text-xs font-medium flex items-center cursor-pointer",
            simRunning
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse"
              : "bg-[#14233a] text-cyan-300 hover:text-cyan-100 hover:bg-[#1c3050] border border-cyan-700/50 shadow-sm"
          )}
          title={simRunning ? "Simulation running at 60× speed. Click to stop." : "Start simulated 60× live telemetry"}
        >
          {simRunning ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <Square className="w-3 h-3" />
              <span className="font-semibold">60× Live</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-cyan-400/40 text-cyan-400" />
              <span>{simLoading ? "Updating…" : "Start Sim"}</span>
            </>
          )}
        </button>

        {demoMessage && (
          <span className="text-[11px] font-mono text-cyan-300 font-medium animate-pulse ml-1 truncate max-w-36 hidden xl:inline">
            {demoMessage}
          </span>
        )}
      </div>

      {/* Right side: Live Stream & Notifications */}
      <div className="flex items-center gap-2 shrink-0">
        <LiveStreamDropdown />
      </div>
    </div>
  );
}
