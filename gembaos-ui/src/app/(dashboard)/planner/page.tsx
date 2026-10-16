"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Play, RefreshCw, CheckCircle, Zap, Calculator, TableProperties } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  solveSchedule,
  calculateCtp,
  calculateMrp,
  calculateLoadShift,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

const GANTT_JOBS = [
  { id: "J001", sku: "TM-300", machine: "PNQ-CNC-07", start: 0, duration: 4, color: "#3B82F6", customer: "Kirin" },
  { id: "J002", sku: "TM-300", machine: "PNQ-CNC-03", start: 2, duration: 6, color: "#3B82F6", customer: "Kirin" },
  { id: "J003", sku: "HSG-220", machine: "RYG-DCM-02", start: 0, duration: 8, color: "#8B5CF6", customer: "Zenith" },
  { id: "J004", sku: "GBX-100", machine: "NGO-GRD-01", start: 1, duration: 5, color: "#22C55E", customer: "Arka" },
  { id: "J005", sku: "TM-300", machine: "PNQ-CNC-07", start: 5, duration: 3, color: "#3B82F6", customer: "Zenith" },
  { id: "J006", sku: "GBX-100", machine: "NGO-FUR-02", start: 3, duration: 7, color: "#22C55E", customer: "Siam" },
];

const MACHINES = ["PNQ-CNC-07", "PNQ-CNC-03", "PNQ-ROB-01", "RYG-DCM-02", "NGO-GRD-01", "NGO-FUR-02"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00–21:00

function GanttChart({ jobs, showDiff }: { jobs: typeof GANTT_JOBS; showDiff: boolean }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="flex">
          <div className="w-24 shrink-0" />
          <div className="flex-1 flex">
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-[9px] text-[#8B98A9] text-center border-l border-[#243042]/50 py-0.5">
                {h}:00
              </div>
            ))}
          </div>
        </div>
        {/* Rows */}
        {MACHINES.map((machine) => {
          const machineJobs = jobs.filter((j) => j.machine === machine);
          return (
            <div key={machine} className="flex items-center border-t border-[#243042]/40 h-6">
              <div className="w-24 shrink-0 pr-2">
                <p className="text-[10px] text-[#8B98A9] font-mono truncate">{machine}</p>
              </div>
              <div className="flex-1 relative h-6">
                {machineJobs.map((job) => (
                  <div
                    key={job.id}
                    className={cn(
                      "absolute top-0.5 h-5 rounded flex items-center px-1.5 text-[9px] text-white font-medium cursor-pointer hover:opacity-90 transition-opacity shadow-sm",
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
                    className="absolute top-0.5 h-5 rounded border-2 border-dashed border-yellow-400/80 bg-yellow-400/15 flex items-center px-1.5 z-10"
                    style={{ left: `${(8 / 16) * 100}%`, width: `${(3 / 16) * 100}%` }}
                    title="Fixed Maintenance Blackout (Thu 14:00-17:00)"
                  >
                    <span className="text-[8px] text-yellow-300 font-bold truncate">Maint 14:00 (Blackout)</span>
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
    <div className="p-3 space-y-2 max-w-[1600px] mx-auto select-none">
      {/* 1. Header Title (outside the bar) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-[#E6EDF3]">Production Planner & CTP</h1>
          <Badge variant="default" className="text-[10px] font-semibold py-0.5">Google OR-Tools CP-SAT</Badge>
        </div>
        <span className="text-xs text-[#8B98A9] font-mono">
          5-min discretized slots · Multi-machine dispatch
        </span>
      </div>

      {/* 2. Solver Runway Ticker Bar */}
      <div className="rounded-xl bg-[#0c1322] border border-[#243042] px-3 py-1.5 shadow-sm flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 shrink-0 pr-2.5 border-r border-[#243042]">
          <span className="text-[11px] font-bold text-[#E6EDF3] uppercase tracking-wider hidden sm:inline">
            Solver Runway
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-semibold border",
              solved
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            )}
          >
            {solved ? (solveResult?.status || "OPTIMAL") : "CP-SAT Ready"}
          </span>
        </div>

        {/* Horizontal Ticker Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full scrollbar-none py-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">OEE (Projected):</span>
            <span className="font-bold text-emerald-400 font-mono">81.2%</span>
            <span className="text-[10px] text-emerald-500 font-mono">(+2.8pp)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#1e293b] bg-[#050912] text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Tardiness:</span>
            <span className="font-bold text-[#E6EDF3] font-mono">0.0h</span>
            <span className="text-[10px] text-[#8B98A9] font-mono">−1.1h opt</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Overtime:</span>
            <span className="font-bold text-amber-300 font-mono">2 shifts</span>
            <span className="text-[10px] text-amber-400/80 font-mono">Pune L2</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-500/30 bg-blue-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Horizon:</span>
            <span className="font-bold text-blue-400 font-mono">7 Days</span>
            <span className="text-[10px] text-[#8B98A9] font-mono">5-min slots</span>
          </div>
        </div>

        {solved && (
          <div className="shrink-0 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>0 Violations</span>
          </div>
        )}
      </div>

      {/* 2. Natural-Language Constraints & Solver Bar */}
      <div className="rounded-xl bg-[#0e1626] border border-[#243042] px-3 py-1.5 shadow-sm flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-xs font-semibold text-[#E6EDF3] shrink-0">Constraints:</span>
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-none">
            {chips.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1 bg-[#1A2230] border border-[#243042] text-[10px] text-[#E6EDF3] px-2 py-0.5 rounded-md shrink-0"
              >
                {c}
                <button
                  onClick={() => setChips((p) => p.filter((x) => x !== c))}
                  className="text-[#8B98A9] hover:text-red-400 ml-0.5 text-xs font-bold"
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
              className="flex-1 min-w-48 bg-transparent text-xs text-[#E6EDF3] outline-none placeholder:text-[#8B98A9]/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant={showDiff ? "primary" : "secondary"}
            className="h-7 text-xs px-2.5"
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? "Hide Baseline" : "Compare Baseline"}
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold border border-emerald-400/30 transition-all shadow-sm"
            onClick={handleSolve}
            disabled={solving}
          >
            {solving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Solving with CP-SAT…
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-white" />
                Solve Schedule
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 3. CP-SAT Interactive Gantt */}
      <Card className="px-3 py-2 bg-[#0c1322] border-[#243042]">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#243042]/50">
          <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-[#8B98A9]">
            Discretized Production Gantt Schedule
          </CardTitle>
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
        </div>
        <GanttChart jobs={GANTT_JOBS} showDiff={showDiff} />
      </Card>

      {/* 4. Bottom Row: CTP Calculator & Energy Load-Shift */}
      <div className="grid grid-cols-12 gap-2.5">
        {/* Capable-To-Promise (CTP) Calculator */}
        <Card glow className="col-span-12 lg:col-span-7 px-3 py-2 bg-[#0c1322] border-[#243042]">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#243042]/50">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-[#8B98A9] flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-primary" />
              Capable-To-Promise (CTP) Engine
            </CardTitle>
            <Badge variant="default" className="text-[9px] py-0 px-2 font-mono">BOM & Lead-Time</Badge>
          </div>

          <div className="space-y-1.5 text-xs">
            {/* Inline 4 inputs + action button in one clean bar */}
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2">
                <label className="text-[9px] text-[#8B98A9] uppercase font-bold block mb-0.5">SKU ID</label>
                <input
                  type="text"
                  value={ctpSku}
                  onChange={(e) => setCtpSku(e.target.value)}
                  className="w-full bg-[#050912] border border-[#243042] rounded px-2 py-0.5 text-xs text-[#E6EDF3] h-6 font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] text-[#8B98A9] uppercase font-bold block mb-0.5">Quantity</label>
                <input
                  type="number"
                  value={ctpQty}
                  onChange={(e) => setCtpQty(+e.target.value)}
                  className="w-full bg-[#050912] border border-[#243042] rounded px-2 py-0.5 text-xs text-[#E6EDF3] h-6 font-mono"
                />
              </div>
              <div className="col-span-3">
                <label className="text-[9px] text-[#8B98A9] uppercase font-bold block mb-0.5">Customer</label>
                <input
                  type="text"
                  value={ctpCustomer}
                  onChange={(e) => setCtpCustomer(e.target.value)}
                  className="w-full bg-[#050912] border border-[#243042] rounded px-2 py-0.5 text-xs text-[#E6EDF3] h-6 font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] text-[#8B98A9] uppercase font-bold block mb-0.5">Due Date</label>
                <input
                  type="date"
                  value={ctpDueDate}
                  onChange={(e) => setCtpDueDate(e.target.value)}
                  className="w-full bg-[#050912] border border-[#243042] rounded px-1.5 py-0.5 text-[11px] text-[#E6EDF3] h-6 font-mono"
                />
              </div>
              <div className="col-span-3">
                <Button
                  size="sm"
                  className="w-full h-6 text-[11px] bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-semibold"
                  onClick={handleCalculateCtp}
                  disabled={ctpLoading}
                >
                  {ctpLoading ? "Evaluating…" : "Check Feasibility"}
                </Button>
              </div>
            </div>

            {/* Feasibility Verdict Box */}
            <div className="bg-[#050912] border border-[#243042] rounded-lg px-2.5 py-1 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[11px] text-[#E6EDF3]">
                  Feasibility: {ctpResult?.feasible !== false ? "3,800 units by Nov 30 (92% conf)" : "Infeasible without expedite"}
                </span>
                <span className="text-[#8B98A9] text-[10px] hidden sm:inline">
                  · Earliest: {ctpResult?.earliest_delivery || "2026-12-06"}
                </span>
              </div>
              <Badge variant="ok" className="text-[9px] py-0 px-1.5">Feasible</Badge>
            </div>

            {/* 3 Resolution Options */}
            <div className="space-y-1">
              {[
                { id: "OPT-SPLIT", desc: "Split: 3,800 by Nov 30 + 1,200 by Dec 6", cost: "$0", margin: "21.4%", ok: true },
                { id: "OPT-EXPEDITE", desc: "All 5,000 by Nov 30 via Saturday overtime", cost: "+$11.2k", margin: "20.1%", ok: true },
                { id: "OPT-AIR", desc: "Air charter from Penang supplier", cost: "+$64k", margin: "16.8%", ok: false },
              ].map((opt) => (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center gap-2 text-[10.5px] px-2 py-0.5 rounded-md border",
                    !opt.ok ? "opacity-40 border-[#243042]" : "border-[#243042] hover:border-[#4F8CFF]/50 bg-[#080d17]/50"
                  )}
                >
                  <span className="font-mono font-bold text-[#8B98A9] text-[10px]">{opt.id}</span>
                  <span className="flex-1 text-[#E6EDF3] truncate">{opt.desc}</span>
                  <span className="text-[#8B98A9] font-mono text-[10px]">{opt.cost}</span>
                  <span className="text-emerald-400 font-mono text-[10px] font-semibold">{opt.margin}</span>
                  {!opt.ok && <Badge variant="critical" className="text-[8px] py-0 px-1">Sub-optimal</Badge>}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Energy Load-Shifting Card */}
        <Card className="col-span-12 lg:col-span-5 px-3 py-2 bg-[#0c1322] border-[#243042] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#243042]/50">
              <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-[#8B98A9] flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-warning" />
                Energy Tariff & Green-Mix Optimizer
              </CardTitle>
              <Badge variant="scenario" className="text-[9px] py-0 px-2 font-mono">Tariff Optimizer</Badge>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#050912] border border-[#243042] rounded-lg px-2.5 py-1">
                  <p className="text-[9px] text-[#8B98A9] uppercase font-bold">Tariff Savings</p>
                  <p className="text-base font-bold text-success font-mono">
                    ${loadShiftData?.savings_usd ?? 680}
                    <span className="text-[9px] text-[#8B98A9] font-normal ml-1">/ cycle</span>
                  </p>
                </div>
                <div className="bg-[#050912] border border-[#243042] rounded-lg px-2.5 py-1">
                  <p className="text-[9px] text-[#8B98A9] uppercase font-bold">CO₂ Avoided</p>
                  <p className="text-base font-bold text-primary font-mono">
                    {loadShiftData?.co2_avoided_tons ?? 1.82} t
                    <span className="text-[9px] text-[#8B98A9] font-normal ml-1">window</span>
                  </p>
                </div>
              </div>

              <div className="bg-[#050912] border border-[#243042] rounded-lg px-2.5 py-1.5 space-y-0.5">
                <p className="text-[#E6EDF3] font-semibold text-[10px]">Recommended Schedule Shift</p>
                <p className="text-[#8B98A9] text-[10px] leading-relaxed line-clamp-2">
                  {loadShiftData?.recommendation ||
                    "Shift NGO-FUR-02 pre-heat from peak tariff (14:00–18:00) to off-peak tariff (02:00–06:00)."}
                </p>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="primary"
            className="w-full h-6 text-xs mt-1.5"
            onClick={() => alert("Load shift schedule updated in MES.")}
          >
            Apply Tariff Shift to Optimizer
          </Button>
        </Card>
      </div>
    </div>
  );
}
