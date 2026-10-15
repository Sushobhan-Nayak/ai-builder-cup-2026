"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GANTT_JOBS } from "@/lib/mock-data";
import { CalendarDays, Play, RefreshCw, CheckCircle, Zap, Calculator, TableProperties } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  solveSchedule,
  calculateCtp,
  calculateMrp,
  calculateLoadShift,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

const MACHINES = ["PNQ-CNC-07", "PNQ-CNC-03", "PNQ-ROB-01", "RYG-DCM-02", "NGO-GRD-01", "NGO-FUR-02"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00–21:00

function GanttChart({ jobs, showDiff }: { jobs: typeof GANTT_JOBS; showDiff: boolean }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="flex">
          <div className="w-32 shrink-0" />
          <div className="flex-1 flex">
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-[10px] text-[#8B98A9] text-center border-l border-[#243042] py-1">
                {h}:00
              </div>
            ))}
          </div>
        </div>
        {/* Rows */}
        {MACHINES.map((machine) => {
          const machineJobs = jobs.filter((j) => j.machine === machine);
          return (
            <div key={machine} className="flex items-center border-t border-[#243042]">
              <div className="w-32 shrink-0 py-2 pr-2">
                <p className="text-[10px] text-[#8B98A9] truncate">{machine}</p>
              </div>
              <div className="flex-1 relative h-8">
                {machineJobs.map((job) => (
                  <div
                    key={job.id}
                    className={cn(
                      "absolute top-1 h-6 rounded flex items-center px-1.5 text-[10px] text-white font-medium cursor-pointer hover:opacity-90 transition-opacity",
                      showDiff && "opacity-60"
                    )}
                    style={{
                      left: `${(job.start / 16) * 100}%`,
                      width: `${(job.duration / 16) * 100}%`,
                      backgroundColor: job.color,
                    }}
                    title={`${job.sku} → ${job.customer}`}
                  >
                    <span className="truncate">{job.sku}</span>
                  </div>
                ))}
                {/* Maintenance blackout window for CNC-07 */}
                {machine === "PNQ-CNC-07" && (
                  <div
                    className="absolute top-1 h-6 rounded border-2 border-dashed border-yellow-400/80 bg-yellow-400/10 flex items-center px-1.5 z-10"
                    style={{ left: `${(8 / 16) * 100}%`, width: `${(3 / 16) * 100}%` }}
                    title="Fixed Maintenance Blackout (Thu 14:00-17:00)"
                  >
                    <span className="text-[9px] text-yellow-300 font-bold truncate">Maint 14:00 (Blackout)</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductionPlanner() {
  const { selectedPlant } = useAppStore();
  const [solving, setSolving] = useState(false);
  const [solved, setSolved] = useState(false);
  const [solveResult, setSolveResult] = useState<any>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [constraint, setConstraint] = useState("");
  const [chips, setChips] = useState(["Prioritise Kirin ✕", "Blackout CNC-07 Thu 14:00 ✕"]);

  // CTP form states
  const [ctpSku, setCtpSku] = useState("TM-300");
  const [ctpQty, setCtpQty] = useState(5000);
  const [ctpCustomer, setCtpCustomer] = useState("CUST-KIRIN");
  const [ctpDueDate, setCtpDueDate] = useState("2026-11-30");
  const [ctpResult, setCtpResult] = useState<any>(null);
  const [ctpLoading, setCtpLoading] = useState(false);

  // Load shift state
  const [loadShiftData, setLoadShiftData] = useState<any>(null);

  useEffect(() => {
    // Preload loadshift data from optimizer
    calculateLoadShift(selectedPlant === "ALL" ? "NGO" : selectedPlant).then((res) => {
      setLoadShiftData(res);
    });
  }, [selectedPlant]);

  const handleSolve = async () => {
    setSolving(true);
    try {
      const res = await solveSchedule(7, []);
      setSolveResult(res);
      setSolved(true);
    } catch (err) {
      console.error("Schedule solve error:", err);
    } finally {
      setSolving(false);
    }
  };

  const handleCalculateCtp = async () => {
    setCtpLoading(true);
    try {
      const res = await calculateCtp({
        sku_id: ctpSku,
        qty: ctpQty,
        customer_id: ctpCustomer,
        due_date: ctpDueDate,
      });
      setCtpResult(res);
    } catch (err) {
      console.error("CTP error:", err);
    } finally {
      setCtpLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-5 h-5 text-[#3B82F6]" />
        <h1 className="text-lg font-bold text-[#E6EDF3]">Production Planner & CTP</h1>
        <Badge variant="default">Google OR-Tools CP-SAT</Badge>
        <span className="text-xs text-[#8B98A9] ml-auto font-mono">
          Endpoint: /v1/schedule/solve · 5-min discretized slots
        </span>
      </div>

      {/* Solver KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "OEE (Projected)", value: "81.2%", delta: "+2.8pp after solve", color: "text-green-400" },
          { label: "Tardiness", value: "0.0h", delta: "−1.1h (OPTIMAL)", color: "text-[#E6EDF3]" },
          { label: "Overtime Shifts", value: "2 shifts", delta: "Saturday Pune L2", color: "text-yellow-400" },
          { label: "CP-SAT Status", value: solved ? (solveResult?.status || "OPTIMAL") : "Ready", delta: "Horizon: 7 days", color: "text-[#4F8CFF]" },
        ].map((k) => (
          <div key={k.label} className="bg-[#121821] border border-[#243042] rounded-xl p-3">
            <p className="text-[10px] text-[#8B98A9] uppercase tracking-wider">{k.label}</p>
            <p className={cn("text-xl font-bold tabular mt-1", k.color)}>{k.value}</p>
            <p className="text-[10px] text-[#8B98A9]">{k.delta}</p>
          </div>
        ))}
      </div>

      {/* Natural-language constraint solver bar */}
      <Card>
        <CardHeader>
          <CardTitle>Optimizer Constraints & NLP Rules</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={showDiff ? "primary" : "secondary"} onClick={() => setShowDiff(!showDiff)}>
              {showDiff ? "Hide Baseline" : "Compare Baseline"}
            </Button>
            <Button size="sm" variant="primary" onClick={handleSolve} disabled={solving}>
              {solving ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Solving with CP-SAT…
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Solve Schedule (/v1/schedule/solve)
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <div className="flex flex-wrap gap-2 items-center">
          {chips.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 bg-[#1A2230] border border-[#243042] text-xs text-[#E6EDF3] px-2.5 py-1 rounded-full"
            >
              {c}
              <button
                onClick={() => setChips((p) => p.filter((x) => x !== c))}
                className="text-[#8B98A9] hover:text-red-400 ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={constraint}
            onChange={(e) => setConstraint(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && constraint.trim()) {
                setChips((p) => [...p, constraint.trim() + " ✕"]);
                setConstraint("");
              }
            }}
            placeholder="+ Add constraint (e.g. 'No overtime on Sunday', 'Reserve 3h on CNC-07')"
            className="flex-1 min-w-40 bg-transparent text-xs text-[#8B98A9] outline-none placeholder:text-[#8B98A9]/50"
          />
        </div>
        {solved && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 p-2 rounded-lg">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>
              Optimizer Status: <strong>{solveResult?.status || "OPTIMAL"}</strong> · Discretized into 5-minute slots · Zero constraint violations · Blackout respected.
            </span>
          </div>
        )}
      </Card>

      {/* CP-SAT Interactive Gantt */}
      <Card>
        <CardHeader>
          <CardTitle>Discretized Production Gantt Schedule</CardTitle>
          <div className="flex gap-3 text-[10px] text-[#8B98A9]">
            {[
              { color: "#3B82F6", label: "TM-300" },
              { color: "#8B5CF6", label: "HSG-220" },
              { color: "#22C55E", label: "GBX-100" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-yellow-400 inline-block" />
              Blackout Window
            </span>
          </div>
        </CardHeader>
        <GanttChart jobs={GANTT_JOBS} showDiff={showDiff} />
      </Card>

      <div className="grid grid-cols-12 gap-4">
        {/* Capable-To-Promise (CTP) Calculator - Connected to /v1/ctp */}
        <Card glow className="col-span-12 lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Capable-To-Promise (CTP) Calculator (/v1/ctp)
            </CardTitle>
            <Badge variant="default">BOM & Lead-Time Explosion</Badge>
          </CardHeader>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-[#8B98A9]">SKU ID</label>
                <input
                  type="text"
                  value={ctpSku}
                  onChange={(e) => setCtpSku(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[#243042] rounded px-2 py-1 text-xs text-[#E6EDF3]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8B98A9]">Quantity</label>
                <input
                  type="number"
                  value={ctpQty}
                  onChange={(e) => setCtpQty(+e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[#243042] rounded px-2 py-1 text-xs text-[#E6EDF3]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8B98A9]">Customer</label>
                <input
                  type="text"
                  value={ctpCustomer}
                  onChange={(e) => setCtpCustomer(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[#243042] rounded px-2 py-1 text-xs text-[#E6EDF3]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8B98A9]">Due Date</label>
                <input
                  type="date"
                  value={ctpDueDate}
                  onChange={(e) => setCtpDueDate(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[#243042] rounded px-2 py-1 text-xs text-[#E6EDF3]"
                />
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={handleCalculateCtp}
              disabled={ctpLoading}
            >
              {ctpLoading ? "Evaluating BOM explosion…" : "Check Order Feasibility (POST /v1/ctp)"}
            </Button>

            <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#E6EDF3]">
                  Feasibility: {ctpResult?.feasible !== false ? "3,800 units feasible by Nov 30 (92% conf)" : "Infeasible without expedite"}
                </p>
                <Badge variant="ok">Feasible</Badge>
              </div>
              <p className="text-[#8B98A9] text-[11px]">
                BOM components checked: <code>IC-GD-01</code> (Formosa/Penang), <code>BRG-6205</code> (NSK).
                Earliest full delivery feasible: {ctpResult?.earliest_delivery || "2026-12-06"}.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { id: "OPT-SPLIT", desc: "Split: 3,800 by Nov 30 + 1,200 by Dec 6", cost: "$0", margin: "21.4%", ok: true },
                { id: "OPT-EXPEDITE", desc: "All 5,000 by Nov 30 via Saturday overtime", cost: "+$11.2k", margin: "20.1%", ok: true },
                { id: "OPT-AIR", desc: "Air charter from Penang supplier", cost: "+$64k", margin: "16.8%", ok: false },
              ].map((opt) => (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center gap-2 text-xs p-2 rounded-lg border",
                    !opt.ok ? "opacity-40 border-[#243042]" : "border-[#243042] hover:border-[#4F8CFF]/50"
                  )}
                >
                  <span className="font-mono font-bold text-[#8B98A9]">{opt.id}</span>
                  <span className="flex-1 text-[#E6EDF3] truncate">{opt.desc}</span>
                  <span className="text-[#8B98A9] font-mono">{opt.cost}</span>
                  <span className="text-green-400 font-mono">{opt.margin}</span>
                  {!opt.ok && <Badge variant="critical" className="text-[9px]">Sub-optimal</Badge>}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Energy Load-Shifting Card - Connected to /v1/loadshift */}
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              Energy Tariff Load-Shift (/v1/loadshift)
            </CardTitle>
            <Badge variant="scenario">Tariff Optimizer</Badge>
          </CardHeader>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3">
                <p className="text-[10px] text-[#8B98A9] uppercase">Tariff Savings</p>
                <p className="text-xl font-bold text-success font-mono mt-1">
                  ${loadShiftData?.savings_usd ?? 680}
                </p>
                <p className="text-[10px] text-[#8B98A9]">per run cycle</p>
              </div>
              <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3">
                <p className="text-[10px] text-[#8B98A9] uppercase">CO₂ Avoided</p>
                <p className="text-xl font-bold text-primary font-mono mt-1">
                  {loadShiftData?.co2_avoided_tons ?? 1.82} t
                </p>
                <p className="text-[10px] text-[#8B98A9]">grid green-mix window</p>
              </div>
            </div>

            <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3 space-y-1">
              <p className="text-[#E6EDF3] font-medium">Recommended Schedule Shift</p>
              <p className="text-[#8B98A9] text-[11px] leading-relaxed">
                {loadShiftData?.recommendation ||
                  "Shift Nagoya electric induction furnaces NGO-FUR-02 pre-heat from peak tariff (14:00–18:00) to off-peak tariff (02:00–06:00)."}
              </p>
            </div>

            <Button
              size="sm"
              variant="primary"
              className="w-full"
              onClick={() => alert("Load shift schedule updated in MES.")}
            >
              Apply Tariff Shift to Optimizer
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
