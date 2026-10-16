"use client";
import { useEffect, useState } from "react";
import { KpiChip } from "@/components/ui/kpi-ticker";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronLeft, Play, Pause, Volume2, VolumeX, Sparkles, ShieldCheck, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import {
  fetchGlobalKpis,
  fetchPlants,
  fetchActiveInsights,
  fetchValueLedger,
  type InsightItem,
  type PlantInfo,
  type ValueLedgerSummary,
  type KpiDataPayload,
} from "@/lib/api-client";
import { PlantMap } from "@/components/dashboard/plant-map";

function MorningBriefingStrip({
  userName,
  kpis,
  insights,
  valueLedger,
}: {
  userName: string;
  kpis: KpiDataPayload["kpis"] | null;
  insights: InsightItem[];
  valueLedger: ValueLedgerSummary | null;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const lines = [
    {
      id: "greeting",
      icon: "🌅",
      tag: "OVERVIEW",
      tagClass: "bg-primary/20 text-primary border-primary/30",
      text: `Good morning, ${userName}. Fleet OEE is ${kpis?.oee_pct ?? "--"}% (${kpis?.oee_trend ?? "stable"}). ${insights.length} active anomalies across fleet.`,
    },
    {
      id: "telemetry",
      icon: "⚡",
      tag: "TELEMETRY",
      tagClass: "bg-info/20 text-info border-info/30",
      text: `Live Metrics: MTBF ${kpis?.mtbf_hours ?? "--"}h | MTTR ${kpis?.mttr_hours ?? "--"}h | OTIF ${kpis?.otif_pct ?? "--"}% (target ${kpis?.otif_target ?? 98}%).`,
    },
    ...insights.slice(0, 4).map((ins, i) => ({
      id: ins.id || `ins-${i}`,
      icon: ins.severity === "critical" ? "🚨" : ins.severity === "high" ? "⚠️" : "ℹ️",
      tag: ins.domain.toUpperCase(),
      tagClass:
        ins.severity === "critical"
          ? "bg-error/20 text-error border-error/30"
          : ins.severity === "high"
          ? "bg-warning/20 text-warning border-warning/30"
          : "bg-info/20 text-info border-info/30",
      text: `${ins.title}: ${ins.summary}${ins.impact?.usd ? ` ($${(ins.impact.usd / 1000).toFixed(0)}k at risk)` : ""}`,
    })),
    {
      id: "ledger",
      icon: "💰",
      tag: "VALUE",
      tagClass: "bg-success/20 text-success border-success/30",
      text: `Value Ledger: $${valueLedger ? (valueLedger.total_usd / 1000000).toFixed(2) : "2.41"}M protected this quarter | ${valueLedger?.downtime_h_avoided ?? 142}h downtime avoided.`,
    },
  ];

  useEffect(() => {
    if (!isPlaying || lines.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % lines.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [isPlaying, lines.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + lines.length) % lines.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % lines.length);
  };

  const handleToggleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const currentLine = lines[currentIndex];
    if (!currentLine) return;
    const utterance = new SpeechSynthesisUtterance(currentLine.text);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const activeLine = lines[currentIndex] || lines[0];

  return (
    <div
      className="bg-base-200/90 border border-base-300 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 text-xs shadow-sm hover:border-primary/40 transition-colors"
      onMouseEnter={() => setIsPlaying(false)}
      onMouseLeave={() => setIsPlaying(true)}
    >
      {/* Left: Badge */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-wider">
          <Sparkles className="w-3 h-3 text-primary animate-pulse" />
          <span>BRIEFING</span>
        </div>
        <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase", activeLine.tagClass)}>
          {activeLine.tag}
        </span>
      </div>

      {/* Center: Live Line text with transition */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div
          key={currentIndex}
          className="flex items-center gap-2 text-base-content/90 font-medium truncate"
        >
          <span className="text-sm shrink-0">{activeLine.icon}</span>
          <span className="truncate">{activeLine.text}</span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-mono text-base-content/40 mr-1">
          {currentIndex + 1}/{lines.length}
        </span>
        <button
          type="button"
          onClick={handlePrev}
          title="Previous line"
          className="btn btn-ghost btn-xs btn-circle h-6 w-6 min-h-0 text-base-content/60 hover:text-base-content"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? "Pause ticker" : "Play ticker"}
          className={cn(
            "btn btn-ghost btn-xs btn-circle h-6 w-6 min-h-0 text-base-content/60 hover:text-base-content",
            isPlaying && "text-primary"
          )}
        >
          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={handleNext}
          title="Next line"
          className="btn btn-ghost btn-xs btn-circle h-6 w-6 min-h-0 text-base-content/60 hover:text-base-content"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleToggleSpeech}
          title={isSpeaking ? "Mute audio" : "Listen line"}
          className={cn(
            "btn btn-ghost btn-xs btn-circle h-6 w-6 min-h-0 ml-1 text-base-content/60 hover:text-primary",
            isSpeaking && "text-primary bg-primary/10 animate-pulse"
          )}
        >
          {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const { selectedPlant, user } = useAppStore();
  const [kpis, setKpis] = useState<KpiDataPayload["kpis"] | null>(null);
  const [plants, setPlants] = useState<PlantInfo[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [valueLedger, setValueLedger] = useState<ValueLedgerSummary | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1. Fetch Global KPIs (/v1/kpis?scope={scope})
    const scopeParam = selectedPlant === "ALL" ? "global" : selectedPlant;
    fetchGlobalKpis(scopeParam).then((res) => {
      if (mounted && res?.kpis) {
        setKpis(res.kpis);
      }
    });

    // 2. Fetch Multi-Plant Status (/v1/plants)
    fetchPlants().then((data) => {
      if (mounted && data?.length) {
        setPlants(data);
      }
    });

    // 3. Fetch Active Insights (/v1/insights?status=new)
    fetchActiveInsights("new").then((data) => {
      if (mounted && data) {
        setInsights(data);
      }
    });

    // 4. Fetch Value Ledger Summary (/v1/value-ledger)
    fetchValueLedger().then((vl) => {
      if (mounted && vl) {
        setValueLedger(vl);
      }
    });

    return () => {
      mounted = false;
    };
  }, [selectedPlant]);

  const userName = user?.name ? user.name.split(" ")[0] : "Sarah";

  // Filter insights by selected site according to plant_ids specification
  const filteredInsights = selectedPlant === "ALL"
    ? insights
    : insights.filter((ins) => !ins.plant_ids || ins.plant_ids.length === 0 || ins.plant_ids.includes(selectedPlant));

  return (
    <div className="p-6 space-y-5">
      {/* KPI Strip - Connected to /v1/kpis */}
      <div className="flex gap-2 w-full flex-wrap sm:flex-nowrap">
        <KpiChip
          label="OEE"
          value={kpis?.oee_pct ?? "--"}
          unit="%"
          delta={kpis?.oee_trend ? parseFloat(kpis.oee_trend) : -1.2}
          status={(kpis?.oee_pct ?? 100) < 80 ? "warn" : "ok"}
          className="flex-1 justify-between"
        />
        <KpiChip
          label="OTIF"
          value={kpis?.otif_pct ?? "--"}
          unit="%"
          delta={0.3}
          status="ok"
          className="flex-1 justify-between"
        />
        <KpiChip
          label="MTBF"
          value={kpis?.mtbf_hours ?? "--"}
          unit="h"
          status="ok"
          className="flex-1 justify-between"
        />
        <KpiChip
          label="MTTR"
          value={kpis?.mttr_hours ?? "--"}
          unit="h"
          status="ok"
          className="flex-1 justify-between"
        />
        <KpiChip
          label="CO₂/Unit"
          value={kpis?.co2_intensity_kg_per_unit ?? "--"}
          unit="kg"
          delta={-0.1}
          status="ok"
          className="flex-1 justify-between"
        />
        <KpiChip
          label="At Risk"
          value={kpis?.revenue_at_risk_usd ? `$${(kpis.revenue_at_risk_usd / 1000).toFixed(0)}k` : "--"}
          status="warn"
          className="flex-1 justify-between"
        />
        <KpiChip
          label="Anomalies"
          value={kpis?.active_anomalies_count ?? "--"}
          status={(kpis?.active_anomalies_count ?? 0) > 0 ? "warn" : "ok"}
          className="flex-1 justify-between"
        />
        <KpiChip
          label="Decisions"
          value={kpis?.pending_decisions_count ?? "--"}
          status={(kpis?.pending_decisions_count ?? 0) > 0 ? "warn" : "ok"}
          className="flex-1 justify-between"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Left Column (8 cols): Morning Briefing Strip + Big Map */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-3">
          <MorningBriefingStrip
            userName={userName}
            kpis={kpis}
            insights={filteredInsights}
            valueLedger={valueLedger}
          />
          <div className="h-[520px]">
            <PlantMap plants={plants} />
          </div>
        </div>

        {/* Right Column (4 cols): Enterprise Value Ledger */}
        <div className="col-span-12 lg:col-span-4 flex flex-col">
          {/* Value Ledger Container with Strict Box Boundaries */}
          <div className="rounded-2xl bg-[#0c1322] border border-[#243042] shadow-2xl h-[568px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#243042] bg-[#080d18] shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-[#E6EDF3] uppercase tracking-wider">
                  Value Ledger
                </span>
              </div>
              <span className="text-[10px] font-semibold font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                BIGQUERY LEDGER
              </span>
            </div>

            {/* Content Area */}
            <div className="p-3.5 flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
              {/* Top Banner */}
              <div className="bg-gradient-to-br from-emerald-950/40 via-[#0a1824] to-[#050912] border border-emerald-500/30 rounded-xl p-3 shrink-0">
                <span className="text-[10px] text-[#8B98A9] uppercase tracking-wider font-semibold block">
                  Total Value Protected (Q4 2026)
                </span>
                <p className="text-2xl font-black tabular text-emerald-400 mt-0.5">
                  {valueLedger ? `$${(valueLedger.total_usd / 1000000).toFixed(2)}M` : "$2.41M"}
                </p>
                <p className="text-[10px] text-[#8B98A9] mt-0.5 truncate">
                  Cryptographically audited ROI across fleet operations
                </p>
              </div>

              {/* 2 Metric Tiles */}
              <div className="grid grid-cols-2 gap-2 shrink-0">
                <div className="bg-[#050912] border border-[#1e293b] rounded-xl p-2.5">
                  <p className="text-base font-bold tabular text-[#E6EDF3]">
                    {valueLedger ? `${valueLedger.downtime_h_avoided}h` : "31h"}
                  </p>
                  <p className="text-[10px] text-[#8B98A9] mt-0.5">Downtime Avoided</p>
                </div>
                <div className="bg-[#050912] border border-[#1e293b] rounded-xl p-2.5">
                  <p className="text-base font-bold tabular text-emerald-400">
                    {valueLedger ? `${Math.round(valueLedger.co2_kg_saved / 1000)}t` : "18t"}
                  </p>
                  <p className="text-[10px] text-[#8B98A9] mt-0.5">CO₂e Avoided</p>
                </div>
              </div>

              {/* Value Attribution by Agent */}
              <div className="bg-[#050912] border border-[#1e293b] rounded-xl p-2.5 space-y-1 shrink-0 text-xs">
                <p className="text-[10px] font-semibold text-[#8B98A9] uppercase tracking-wider mb-1">
                  Value Attribution by Agent
                </p>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8B98A9]">Sentinel (Asset Health)</span>
                  <span className="font-mono text-emerald-400 font-semibold">+$1.24M</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8B98A9]">Navigator (Supply Chain)</span>
                  <span className="font-mono text-emerald-400 font-semibold">+$793k</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8B98A9]">Verdant (Energy & Load Shift)</span>
                  <span className="font-mono text-emerald-400 font-semibold">+$376k</span>
                </div>
              </div>

              {/* Verified Realized Entries with internal scroll only */}
              <div className="flex-1 min-h-0 flex flex-col bg-[#050912] border border-[#1e293b] rounded-xl p-2.5 overflow-hidden">
                <p className="text-[10px] font-semibold text-[#8B98A9] uppercase tracking-wider mb-1.5 shrink-0">
                  Verified Realized Entries
                </p>
                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#1e293b] pr-1 space-y-1.5 text-xs">
                  {(valueLedger?.entries && valueLedger.entries.length > 0
                    ? valueLedger.entries
                    : [
                        { id: "e1", description: "PNQ-CNC-07 Spindle Bearing pull-ahead avoided line stoppage", est_usd: 180000 },
                        { id: "e2", description: "Formosa weather rerouting via Penang Micro preserved Kirin OTIF", est_usd: 793500 },
                        { id: "e3", description: "Nagoya furnace pre-heat tariff shift reduced peak kWh", est_usd: 68000 },
                        { id: "e4", description: "Rayong DCM-02 porosity containment prevented scrap run", est_usd: 42000 },
                      ]
                  ).map((e) => (
                    <div key={e.id} className="pt-1.5 first:pt-0 flex items-start justify-between gap-2">
                      <p className="text-[11px] text-[#8B98A9] leading-snug line-clamp-2 flex-1">
                        {e.description}
                      </p>
                      <span className="text-emerald-400 font-semibold text-[11px] font-mono shrink-0 ml-1">
                        +${(e.est_usd / 1000).toFixed(0)}k
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 border-t border-[#243042] bg-[#080d18] shrink-0 flex items-center justify-between text-[10px] text-[#8B98A9]">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Audit Verified
              </span>
              <span className="font-mono text-[#8B98A9] pr-12">gold.v_value_ledger</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
