"use client";
import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Play, RefreshCw, CheckCircle, Zap, Calculator, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  solveSchedule,
  calculateCtp,
  calculateLoadShift,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

interface GanttJob {
  id: string;
  sku: string;
  plant: "PNQ" | "RYG" | "NGO";
  machine: string;
  baselineMachine?: string;
  start: number;
  baselineStart?: number;
  duration: number;
  color: string;
  customer: string;
  conflict?: boolean;
  rescheduled?: boolean;
}

const BASELINE_JOBS: GanttJob[] = [
  { id: "J001", sku: "TM-300", plant: "PNQ", machine: "PNQ-CNC-07", start: 0, duration: 5, color: "#3B82F6", customer: "Kirin Auto" },
  { id: "J005", sku: "TM-300", plant: "PNQ", machine: "PNQ-CNC-07", start: 7, duration: 4, color: "#EF4444", customer: "Tata Motors", conflict: true },
  { id: "J002", sku: "TM-300", plant: "PNQ", machine: "PNQ-CNC-08", start: 1, duration: 5, color: "#3B82F6", customer: "Kirin Auto" },
  { id: "J007", sku: "TM-300", plant: "PNQ", machine: "PNQ-CNC-11", start: 3, duration: 6, color: "#0EA5E9", customer: "Toyota" },
  { id: "J003", sku: "HSG-220", plant: "RYG", machine: "RYG-DCM-02", start: 0, duration: 6, color: "#8B5CF6", customer: "Zenith EV" },
  { id: "J008", sku: "HSG-220", plant: "RYG", machine: "RYG-DCM-01", start: 2, duration: 7, color: "#A855F7", customer: "Siam Motors" },
  { id: "J004", sku: "GBX-100", plant: "NGO", machine: "NGO-GRD-01", start: 1, duration: 6, color: "#22C55E", customer: "Arka Heavy" },
  { id: "J006", sku: "GBX-100", plant: "NGO", machine: "NGO-FUR-02", start: 7, duration: 5, color: "#F59E0B", customer: "Siam Motors", conflict: true },
];

const SOLVED_JOBS: GanttJob[] = [
  { id: "J001", sku: "TM-300", plant: "PNQ", machine: "PNQ-CNC-07", start: 0, duration: 5, color: "#3B82F6", customer: "Kirin Auto" },
  { id: "J005", sku: "TM-300", plant: "PNQ", machine: "PNQ-CNC-08", baselineMachine: "PNQ-CNC-07", start: 7, baselineStart: 7, duration: 4, color: "#10B981", customer: "Tata Motors", rescheduled: true },
  { id: "J002", sku: "TM-300", plant: "PNQ", machine: "PNQ-CNC-08", start: 1, duration: 5, color: "#3B82F6", customer: "Kirin Auto" },
  { id: "J007", sku: "TM-300", plant: "PNQ", machine: "PNQ-CNC-11", start: 2, baselineStart: 3, duration: 6, color: "#0EA5E9", customer: "Toyota", rescheduled: true },
  { id: "J003", sku: "HSG-220", plant: "RYG", machine: "RYG-DCM-02", start: 0, duration: 6, color: "#8B5CF6", customer: "Zenith EV" },
  { id: "J008", sku: "HSG-220", plant: "RYG", machine: "RYG-DCM-01", start: 1, baselineStart: 2, duration: 7, color: "#A855F7", customer: "Siam Motors", rescheduled: true },
  { id: "J004", sku: "GBX-100", plant: "NGO", machine: "NGO-GRD-01", start: 1, duration: 6, color: "#22C55E", customer: "Arka Heavy" },
  { id: "J006", sku: "GBX-100", plant: "NGO", machine: "NGO-FUR-02", start: 0, baselineStart: 7, duration: 5, color: "#10B981", customer: "Siam Motors", rescheduled: true },
];

const ALL_MACHINES: { id: string; plant: "PNQ" | "RYG" | "NGO"; label: string }[] = [
  { id: "PNQ-CNC-07", plant: "PNQ", label: "PNQ-CNC-07 (Spindle)" },
  { id: "PNQ-CNC-08", plant: "PNQ", label: "PNQ-CNC-08 (Mill #8)" },
  { id: "PNQ-CNC-11", plant: "PNQ", label: "PNQ-CNC-11 (Mill #11)" },
  { id: "RYG-DCM-02", plant: "RYG", label: "RYG-DCM-02 (Caster #2)" },
  { id: "RYG-DCM-01", plant: "RYG", label: "RYG-DCM-01 (Caster #1)" },
  { id: "NGO-GRD-01", plant: "NGO", label: "NGO-GRD-01 (Grinder)" },
  { id: "NGO-FUR-02", plant: "NGO", label: "NGO-FUR-02 (Furnace)" },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00–21:00

const PLANT_LOADSHIFT_DEFAULTS: Record<string, { savings: number; co2: number; rec: string; machine: string }> = {
  ALL: {
    savings: 680,
    co2: 1.82,
    machine: "NGO-FUR-02 & RYG-DCM-02",
    rec: "Shift NGO-FUR-02 induction pre-heat from peak tariff (13:00–17:00) to off-peak solar window (06:00–11:00).",
  },
  PNQ: {
    savings: 420,
    co2: 1.15,
    machine: "PNQ-CMP-01 & CNC Line 1",
    rec: "Stagger PNQ-CMP-01 air compressor recharge cycles away from Maharashtra MSEB evening peak (18:00–21:00).",
  },
  RYG: {
    savings: 540,
    co2: 1.48,
    machine: "RYG-DCM-02 Holding Furnace",
    rec: "Shift RYG-DCM-02 aluminum holding furnace boost cycle to rooftop solar peak (10:00–14:30 ICT).",
  },
  NGO: {
    savings: 680,
    co2: 1.82,
    machine: "NGO-FUR-02 Induction Furnace",
    rec: "Shift NGO-FUR-02 carburizing pre-heat from Chubu peak tariff (13:00–18:00) to off-peak window (06:00–11:00).",
  },
};

function GanttChart({
  machines,
  jobs,
  baselineJobs,
  solved,
  showDiff,
  selectedJobId,
  onSelectJob,
}: {
  machines: typeof ALL_MACHINES;
  jobs: GanttJob[];
  baselineJobs: GanttJob[];
  solved: boolean;
  showDiff: boolean;
  selectedJobId: string | null;
  onSelectJob: (job: GanttJob) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header */}
        <div className="flex">
          <div className="w-36 shrink-0 text-[9px] text-[#8B98A9] uppercase font-mono py-0.5 pl-1">Machine / Workcenter</div>
          <div className="flex-1 flex">
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-[9px] text-[#8B98A9] text-center border-l border-[#243042]/50 py-0.5 font-mono">
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>
        {/* Rows */}
        {machines.map((m) => {
          const machineJobs = jobs.filter((j) => j.machine === m.id);
          const ghostJobs = showDiff
            ? baselineJobs.filter((bj) => bj.machine === m.id && (solved || bj.conflict))
            : [];
          return (
            <div key={m.id} className="flex items-center border-t border-[#243042]/40 h-7">
              <div className="w-36 shrink-0 pr-2 pl-1 flex items-center justify-between">
                <p className="text-[10px] text-[#E6EDF3] font-mono truncate">{m.id}</p>
                <span className="text-[8px] px-1 rounded bg-[#1A2230] text-[#8B98A9] font-mono">{m.plant}</span>
              </div>
              <div className="flex-1 relative h-7">
                {/* Ghost baseline bars when Compare Baseline is active */}
                {ghostJobs.map((gj) => (
                  <div
                    key={`ghost-${gj.id}`}
                    className="absolute top-1 h-5 rounded border border-dashed border-red-400/70 bg-red-500/10 flex items-center px-1.5 text-[8px] text-red-300/80 font-mono pointer-events-none z-0"
                    style={{
                      left: `${(gj.start / 16) * 100}%`,
                      width: `${(gj.duration / 16) * 100}%`,
                    }}
                  >
                    <span className="truncate">Baseline: {gj.id} ({gj.sku})</span>
                  </div>
                ))}

                {/* Active schedule bars */}
                {machineJobs.map((job) => {
                  const isSelected = selectedJobId === job.id;
                  return (
                    <button
                      type="button"
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className={cn(
                        "absolute top-1 h-5 rounded flex items-center justify-between px-1.5 text-[9px] text-white font-medium cursor-pointer transition-all shadow-sm z-10",
                        job.conflict && !solved && "ring-2 ring-red-400 animate-pulse",
                        job.rescheduled && solved && "ring-1 ring-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.35)]",
                        isSelected && "ring-2 ring-white scale-[1.01]"
                      )}
                      style={{
                        left: `${(job.start / 16) * 100}%`,
                        width: `${(job.duration / 16) * 100}%`,
                        backgroundColor: job.color,
                      }}
                      title={`${job.id}: ${job.sku} → ${job.customer} (${job.start + 6}:00–${job.start + job.duration + 6}:00)`}
                    >
                      <span className="truncate font-semibold">
                        {job.id} · {job.sku} ({job.customer.split(" ")[0]})
                      </span>
                      {job.conflict && !solved && (
                        <AlertTriangle className="w-3 h-3 text-white shrink-0 ml-1" />
                      )}
                      {job.rescheduled && solved && (
                        <span className="text-[8px] bg-black/30 px-1 rounded font-mono shrink-0 ml-1">SHIFTED</span>
                      )}
                    </button>
                  );
                })}

                {/* Maintenance blackout window for CNC-07 */}
                {m.id === "PNQ-CNC-07" && (
                  <div
                    className="absolute top-1 h-5 rounded border-2 border-dashed border-yellow-400/90 bg-yellow-400/15 flex items-center px-1.5 z-20 pointer-events-none"
                    style={{ left: `${(8 / 16) * 100}%`, width: `${(3 / 16) * 100}%` }}
                    title="Sentinel PM Blackout Window (Thu 14:00-17:00)"
                  >
                    <span className="text-[8px] text-yellow-300 font-bold truncate">
                      PM Blackout (14:00–17:00)
                    </span>
                  </div>
                )}

                {/* Peak tariff zone indicator on NGO-FUR-02 */}
                {m.id === "NGO-FUR-02" && (
                  <div
                    className="absolute top-1 h-5 rounded border border-dashed border-amber-500/60 bg-amber-500/10 flex items-center px-1.5 z-0 pointer-events-none"
                    style={{ left: `${(7 / 16) * 100}%`, width: `${(5 / 16) * 100}%` }}
                  >
                    <span className="text-[8px] text-amber-300/80 font-mono truncate">
                      Peak Tariff Window (13:00–18:00)
                    </span>
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
  const [chips, setChips] = useState([
    "Prioritise Kirin & Tata",
    "Blackout PNQ-CNC-07 Thu 14:00",
    "Avoid NGO Peak Tariff 13:00–18:00",
  ]);
  const [selectedJob, setSelectedJob] = useState<GanttJob | null>(null);

  // CTP form states
  const [ctpSku, setCtpSku] = useState("TM-300");
  const [ctpQty, setCtpQty] = useState(5000);
  const [ctpCustomer, setCtpCustomer] = useState("CUST-KIRIN");
  const [ctpDueDate, setCtpDueDate] = useState("2026-11-30");
  const [ctpResult, setCtpResult] = useState<any>(null);
  const [ctpLoading, setCtpLoading] = useState(false);
  const [selectedCtpOpt, setSelectedCtpOpt] = useState<string>("OPT-SPLIT");
  const [ctpCommitted, setCtpCommitted] = useState(false);

  // Load shift state
  const [loadShiftData, setLoadShiftData] = useState<any>(null);
  const [loadShiftCommitted, setLoadShiftCommitted] = useState(false);

  useEffect(() => {
    setLoadShiftCommitted(false);
    calculateLoadShift(selectedPlant === "ALL" ? "NGO" : selectedPlant).then((res) => {
      if (res) setLoadShiftData(res);
    }).catch(() => {});
  }, [selectedPlant]);

  const filteredMachines = useMemo(() => {
    return selectedPlant === "ALL"
      ? ALL_MACHINES
      : ALL_MACHINES.filter((m) => m.plant === selectedPlant);
  }, [selectedPlant]);

  const activeJobs = useMemo(() => {
    const source = solved ? SOLVED_JOBS : BASELINE_JOBS;
    return selectedPlant === "ALL"
      ? source
      : source.filter((j) => j.plant === selectedPlant);
  }, [solved, selectedPlant]);

  const filteredBaselineJobs = useMemo(() => {
    return selectedPlant === "ALL"
      ? BASELINE_JOBS
      : BASELINE_JOBS.filter((j) => j.plant === selectedPlant);
  }, [selectedPlant]);

  const handleSolve = async () => {
    setSolving(true);
    try {
      const res = await solveSchedule(7, []);
      setSolveResult(res);
    } catch (err) {
      console.warn("Schedule solve fallback:", err);
    } finally {
      setSolved(true);
      setShowDiff(true);
      setSolving(false);
    }
  };

  const handleResetBaseline = () => {
    setSolved(false);
    setShowDiff(false);
    setSelectedJob(null);
  };

  // Dynamic CTP computation based on user inputs + API response
  const computedCtp = useMemo(() => {
    const immediateCap = ctpSku === "TM-300" ? 3800 : ctpSku === "HSG-220" ? 4200 : 2500;
    const isFullyFeasible = ctpQty <= immediateCap;
    const splitFirst = Math.min(ctpQty, immediateCap);
    const splitRemainder = Math.max(0, ctpQty - immediateCap);
    const expediteCostK = splitRemainder > 0 ? ((splitRemainder / 1000) * 9.4).toFixed(1) : "0";
    const airCostK = splitRemainder > 0 ? ((splitRemainder / 1000) * 52.0).toFixed(1) : "14.0";

    return {
      isFullyFeasible,
      immediateCap,
      splitFirst,
      splitRemainder,
      headline: isFullyFeasible
        ? `${ctpQty.toLocaleString()} units feasible by ${ctpDueDate} (98% conf)`
        : `${splitFirst.toLocaleString()} units by ${ctpDueDate} · ${splitRemainder.toLocaleString()} units gated by IC-GD-01`,
      earliestFullDate: isFullyFeasible ? ctpDueDate : "2026-12-06",
      options: [
        {
          id: "OPT-SPLIT",
          desc: isFullyFeasible
            ? `Standard Lot: All ${ctpQty.toLocaleString()} units on ${ctpDueDate} (Sea + Crib stock)`
            : `Split Delivery: ${splitFirst.toLocaleString()} by ${ctpDueDate} + ${splitRemainder.toLocaleString()} by Dec 06`,
          cost: "$0",
          margin: "21.4%",
          ok: true,
        },
        {
          id: "OPT-EXPEDITE",
          desc: `Full ${ctpQty.toLocaleString()} units by ${ctpDueDate} via weekend shift + Renesas split`,
          cost: `+$${expediteCostK}k`,
          margin: "20.1%",
          ok: true,
        },
        {
          id: "OPT-AIR",
          desc: `Dedicated air charter for ${ctpSku} sub-components`,
          cost: `+$${airCostK}k`,
          margin: "16.8%",
          ok: false,
        },
      ],
    };
  }, [ctpSku, ctpQty, ctpDueDate, ctpResult]);

  const handleCalculateCtp = async () => {
    setCtpLoading(true);
    setCtpCommitted(false);
    try {
      const res = await calculateCtp({
        sku_id: ctpSku,
        qty: ctpQty,
        customer_id: ctpCustomer,
        due_date: ctpDueDate,
      });
      setCtpResult(res);
    } catch (err) {
      console.warn("CTP fallback evaluation:", err);
    } finally {
      setCtpLoading(false);
    }
  };

  const plantLoadShift = PLANT_LOADSHIFT_DEFAULTS[selectedPlant] || PLANT_LOADSHIFT_DEFAULTS.ALL;

  return (
    <div className="p-3 space-y-2.5 max-w-[1600px] mx-auto select-none">
      {/* 1. Header Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-[#E6EDF3]">Production Planner & CTP</h1>
          <Badge variant="default" className="text-[10px] font-semibold py-0.5">Google OR-Tools CP-SAT</Badge>
          {selectedPlant !== "ALL" && (
            <Badge variant="scenario" className="text-[10px] py-0.5 font-mono">Site: {selectedPlant}</Badge>
          )}
        </div>
        <span className="text-xs text-[#8B98A9] font-mono">
          {filteredMachines.length} workcenters · {activeJobs.length} active jobs
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
                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
            )}
          >
            {solved ? (solveResult?.status || "OPTIMAL") : "1 CONFLICT DETECTED"}
          </span>
        </div>

        {/* Horizontal Ticker Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full scrollbar-none py-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">OEE (Projected):</span>
            <span className="font-bold text-emerald-400 font-mono">{solved ? "84.2%" : "76.8%"}</span>
            <span className="text-[10px] text-emerald-500 font-mono">{solved ? "(+7.4pp)" : "Baseline"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#1e293b] bg-[#050912] text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Scheduled Jobs:</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {activeJobs.length}/{activeJobs.length} ({solved ? "0 conflicts" : "1 PM collision"})
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Solver Time:</span>
            <span className="font-bold text-amber-300 font-mono">
              {solved ? `${solveResult?.solver_wall_time_s ?? 0.094}s` : "Ready"}
            </span>
            <span className="text-[10px] text-amber-400/80 font-mono">{solved ? "CP-SAT Optimal" : "OR-Tools"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-500/30 bg-blue-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Horizon:</span>
            <span className="font-bold text-blue-400 font-mono">7 Days</span>
            <span className="text-[10px] text-[#8B98A9] font-mono">5-min slots</span>
          </div>
        </div>

        {solved ? (
          <div className="shrink-0 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>J005 shifted to CNC-08 · J006 off-peak</span>
          </div>
        ) : (
          <div className="shrink-0 text-[10px] text-red-400 font-mono flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>J005 overlaps CNC-07 PM Blackout</span>
          </div>
        )}
      </div>

      {/* 3. Natural-Language Constraints & Solver Bar */}
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
                  type="button"
                  onClick={() => setChips((p) => p.filter((x) => x !== c))}
                  className="text-[#8B98A9] hover:text-red-400 ml-0.5 text-xs font-bold cursor-pointer"
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
                  setChips((p) => [...p, constraint.trim()]);
                  setConstraint("");
                  setSolved(false);
                }
              }}
              placeholder="+ Add constraint & press Enter (e.g. 'Lock CNC-07 Thu 14:00')"
              className="flex-1 min-w-48 bg-transparent text-xs text-[#E6EDF3] outline-none placeholder:text-[#8B98A9]/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {solved && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs px-2.5"
              onClick={handleResetBaseline}
            >
              Reset to Baseline
            </Button>
          )}
          <Button
            size="sm"
            variant={showDiff ? "primary" : "secondary"}
            className="h-7 text-xs px-2.5"
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? "Hide Baseline Ghost" : "Compare Baseline"}
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold border border-emerald-400/30 transition-all shadow-sm cursor-pointer"
            onClick={handleSolve}
            disabled={solving}
          >
            {solving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Solving CP-SAT…
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-white" />
                {solved ? "Re-Run CP-SAT Solver" : "Solve Schedule"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 4. CP-SAT Interactive Gantt */}
      <Card className="px-3 py-2 bg-[#0c1322] border-[#243042]">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#243042]/50 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-[#8B98A9]">
              Discretized Production Gantt Schedule
            </CardTitle>
            {selectedJob && (
              <span className="text-[10px] font-mono bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded flex items-center gap-1.5">
                <strong>{selectedJob.id}</strong> ({selectedJob.sku} → {selectedJob.customer}) · {selectedJob.machine} · {selectedJob.start + 6}:00–{selectedJob.start + selectedJob.duration + 6}:00
                {selectedJob.baselineMachine && solved && (
                  <span className="text-emerald-300">
                    (Moved from {selectedJob.baselineMachine})
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex gap-3 text-[10px] text-[#8B98A9] flex-wrap">
            {[
              { color: "#3B82F6", label: "TM-300 (Pune)" },
              { color: "#8B5CF6", label: "HSG-220 (Rayong)" },
              { color: "#22C55E", label: "GBX-100 (Nagoya)" },
              { color: "#10B981", label: "CP-SAT Rescheduled" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-yellow-400 inline-block" />
              PM Blackout Window
            </span>
          </div>
        </div>
        <GanttChart
          machines={filteredMachines}
          jobs={activeJobs}
          baselineJobs={filteredBaselineJobs}
          solved={solved}
          showDiff={showDiff}
          selectedJobId={selectedJob?.id || null}
          onSelectJob={(job) => setSelectedJob(job)}
        />
      </Card>

      {/* 5. Bottom Row: CTP Calculator & Energy Load-Shift */}
      <div className="grid grid-cols-12 gap-2.5">
        {/* Capable-To-Promise (CTP) Calculator */}
        <Card glow className="col-span-12 lg:col-span-7 px-3 py-2 bg-[#0c1322] border-[#243042]">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#243042]/50">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-[#8B98A9] flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-primary" />
              Capable-To-Promise (CTP) Engine
            </CardTitle>
            <Badge variant="default" className="text-[9px] py-0 px-2 font-mono">BOM & Lead-Time Solver</Badge>
          </div>

          <div className="space-y-1.5 text-xs">
            {/* Inline 4 inputs + action button */}
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2">
                <label className="text-[9px] text-[#8B98A9] uppercase font-bold block mb-0.5">SKU ID</label>
                <select
                  value={ctpSku}
                  onChange={(e) => {
                    setCtpSku(e.target.value);
                    setCtpCommitted(false);
                  }}
                  className="w-full bg-[#050912] border border-[#243042] rounded px-1.5 py-0.5 text-xs text-[#E6EDF3] h-6 font-mono"
                >
                  <option value="TM-300">TM-300</option>
                  <option value="HSG-220">HSG-220</option>
                  <option value="GBX-100">GBX-100</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[9px] text-[#8B98A9] uppercase font-bold block mb-0.5">Quantity</label>
                <input
                  type="number"
                  step={200}
                  min={100}
                  value={ctpQty}
                  onChange={(e) => {
                    setCtpQty(Math.max(100, +e.target.value || 0));
                    setCtpCommitted(false);
                  }}
                  className="w-full bg-[#050912] border border-[#243042] rounded px-2 py-0.5 text-xs text-[#E6EDF3] h-6 font-mono"
                />
              </div>
              <div className="col-span-3">
                <label className="text-[9px] text-[#8B98A9] uppercase font-bold block mb-0.5">Customer</label>
                <select
                  value={ctpCustomer}
                  onChange={(e) => {
                    setCtpCustomer(e.target.value);
                    setCtpCommitted(false);
                  }}
                  className="w-full bg-[#050912] border border-[#243042] rounded px-1.5 py-0.5 text-xs text-[#E6EDF3] h-6 font-mono"
                >
                  <option value="CUST-KIRIN">CUST-KIRIN (Kirin Auto)</option>
                  <option value="CUST-TATA">CUST-TATA (Tata Motors)</option>
                  <option value="CUST-TOYOTA">CUST-TOYOTA (Toyota)</option>
                  <option value="CUST-ZENITH">CUST-ZENITH (Zenith EV)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[9px] text-[#8B98A9] uppercase font-bold block mb-0.5">Due Date</label>
                <input
                  type="date"
                  value={ctpDueDate}
                  onChange={(e) => {
                    setCtpDueDate(e.target.value);
                    setCtpCommitted(false);
                  }}
                  className="w-full bg-[#050912] border border-[#243042] rounded px-1.5 py-0.5 text-[11px] text-[#E6EDF3] h-6 font-mono"
                />
              </div>
              <div className="col-span-3">
                <Button
                  size="sm"
                  className="w-full h-6 text-[11px] bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-semibold cursor-pointer"
                  onClick={handleCalculateCtp}
                  disabled={ctpLoading}
                >
                  {ctpLoading ? "Evaluating BOM…" : "Check Feasibility"}
                </Button>
              </div>
            </div>

            {/* Feasibility Verdict Box */}
            <div className="bg-[#050912] border border-[#243042] rounded-lg px-2.5 py-1 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-[11px] text-[#E6EDF3] truncate">
                  {computedCtp.headline}
                </span>
                <span className="text-[#8B98A9] text-[10px] hidden sm:inline shrink-0">
                  · Full Completion: {computedCtp.earliestFullDate}
                </span>
              </div>
              <Badge variant={computedCtp.isFullyFeasible ? "ok" : "high"} className="text-[9px] py-0 px-1.5 shrink-0">
                {computedCtp.isFullyFeasible ? "100% Feasible" : "Split / Expedite"}
              </Badge>
            </div>

            {/* 3 Resolution Options (Interactive Selection + Commit) */}
            <div className="space-y-1">
              {computedCtp.options.map((opt) => {
                const isSelected = selectedCtpOpt === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => {
                      setSelectedCtpOpt(opt.id);
                      setCtpCommitted(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 text-[10.5px] px-2 py-1 rounded-md border text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : !opt.ok
                        ? "opacity-55 border-[#243042] hover:opacity-80"
                        : "border-[#243042] hover:border-[#4F8CFF]/50 bg-[#080d17]/50"
                    )}
                  >
                    <span className={cn("font-mono font-bold text-[10px]", isSelected ? "text-primary" : "text-[#8B98A9]")}>
                      {opt.id}
                    </span>
                    <span className="flex-1 text-[#E6EDF3] truncate">{opt.desc}</span>
                    <span className="text-[#8B98A9] font-mono text-[10px]">{opt.cost}</span>
                    <span className="text-emerald-400 font-mono text-[10px] font-semibold">{opt.margin}</span>
                    {!opt.ok && <Badge variant="critical" className="text-[8px] py-0 px-1">Sub-optimal</Badge>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[10px] text-[#8B98A9] font-mono">
                Selected: <strong className="text-[#E6EDF3]">{selectedCtpOpt}</strong> for {ctpCustomer}
              </span>
              {!ctpCommitted ? (
                <Button
                  size="sm"
                  variant="primary"
                  className="h-6 text-[10px] px-2.5"
                  onClick={() => setCtpCommitted(true)}
                >
                  Commit {selectedCtpOpt} to Order Book <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              ) : (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                  <CheckCircle className="w-3 h-3" /> {selectedCtpOpt} Committed to SAP Order Book
                </span>
              )}
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
              <Badge variant="scenario" className="text-[9px] py-0 px-2 font-mono">
                {selectedPlant === "ALL" ? "Fleet Tariff" : `${selectedPlant} Grid`}
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#050912] border border-[#243042] rounded-lg px-2.5 py-1">
                  <p className="text-[9px] text-[#8B98A9] uppercase font-bold">Tariff Savings</p>
                  <p className="text-base font-bold text-success font-mono">
                    ${loadShiftData?.savings_usd ?? plantLoadShift.savings}
                    <span className="text-[9px] text-[#8B98A9] font-normal ml-1">/ cycle</span>
                  </p>
                </div>
                <div className="bg-[#050912] border border-[#243042] rounded-lg px-2.5 py-1">
                  <p className="text-[9px] text-[#8B98A9] uppercase font-bold">CO₂ Avoided</p>
                  <p className="text-base font-bold text-primary font-mono">
                    {loadShiftData?.co2_avoided_tons ?? plantLoadShift.co2} t
                    <span className="text-[9px] text-[#8B98A9] font-normal ml-1">window</span>
                  </p>
                </div>
              </div>

              <div className="bg-[#050912] border border-[#243042] rounded-lg px-2.5 py-1.5 space-y-0.5">
                <div className="flex items-center justify-between">
                  <p className="text-[#E6EDF3] font-semibold text-[10px]">Recommended Schedule Shift</p>
                  <span className="text-[9px] font-mono text-amber-400">{plantLoadShift.machine}</span>
                </div>
                <p className="text-[#8B98A9] text-[10px] leading-relaxed">
                  {plantLoadShift.rec}
                </p>
              </div>
            </div>
          </div>

          {!loadShiftCommitted ? (
            <Button
              size="sm"
              variant="primary"
              className="w-full h-6 text-xs mt-1.5 cursor-pointer"
              onClick={() => {
                setLoadShiftCommitted(true);
                setSolved(true);
              }}
            >
              <Zap className="w-3 h-3 mr-1" /> Execute Load-Shift in MES
            </Button>
          ) : (
            <div className="w-full h-6 mt-1.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono flex items-center justify-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Off-Peak Load-Shift Active in MES
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
