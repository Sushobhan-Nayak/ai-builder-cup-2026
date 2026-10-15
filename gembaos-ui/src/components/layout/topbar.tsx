"use client";
import { Bell, Play, Square, Sparkles, CheckCircle, XCircle, Scale, AlertTriangle } from "lucide-react";
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
  type DecisionItem,
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
    <div className="dropdown dropdown-end">
      <button tabIndex={0} className="btn btn-ghost btn-sm gap-1.5 relative">
        <Scale className="w-3.5 h-3.5" />
        <span>Decision Inbox</span>
        {pending > 0 && (
          <span className="badge badge-error badge-xs absolute -top-1 -right-1">{pending}</span>
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

export function TopBar() {
  const {
    selectedPlant,
    setSelectedPlant,
    plants,
    setPlants,
    activeAlertsCount,
    setActiveAlertsCount,
    simRunning,
    setSimRunning,
  } = useAppStore();

  useEffect(() => {
    let mounted = true;
    fetchPlants().then((data) => {
      if (mounted && data?.length) {
        setPlants(data);
      }
    });

    fetchActiveInsights("new").then((insights) => {
      if (mounted) {
        setActiveAlertsCount(insights.length);
      }
    });

    return () => {
      mounted = false;
    };
  }, [setPlants, setActiveAlertsCount]);

  return (
    <div className="navbar bg-base-200 border-b border-base-300 min-h-12 px-4 gap-3">
      {/* Plant switcher - Connected to /v1/plants */}
      <select
        value={selectedPlant}
        onChange={(e) => setSelectedPlant(e.target.value)}
        className="select select-ghost select-sm text-sm focus:outline-none"
      >
        <option value="ALL">🌐 All Plants</option>
        {plants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.flag ? `${p.flag} ` : ""}{p.name} ({p.id})
          </option>
        ))}
      </select>

      {/* Ask GembaOS */}
      <Link href="/chat" className="btn btn-ghost btn-sm gap-2 text-base-content/60 hover:text-base-content">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span>Ask GembaOS</span>
        <kbd className="kbd kbd-sm text-[10px]">⌘K</kbd>
      </Link>

      {/* Decision Inbox dropdown - Connected to /v1/decisions */}
      <DecisionDropdown />

      <div className="flex-1" />

      {/* Sim control */}
      <button
        onClick={() => setSimRunning(!simRunning)}
        className={cn("btn btn-sm gap-1.5", simRunning ? "btn-success btn-outline" : "btn-ghost")}
      >
        {simRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {simRunning ? "60× Live" : "Start Sim"}
      </button>

      <div className="divider divider-horizontal mx-0 h-5 self-center" />

      {/* Notifications - Connected to /v1/insights?status=new */}
      <Link
        href="/"
        className="btn btn-ghost btn-sm btn-circle relative"
        title={`${activeAlertsCount} active alerts`}
      >
        <Bell className="w-4 h-4" />
        {activeAlertsCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full animate-pulse" />
        )}
      </Link>
    </div>
  );
}
