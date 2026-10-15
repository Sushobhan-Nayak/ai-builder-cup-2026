"use client";
import { useEffect, useState, useRef } from "react";
import { KpiChip } from "@/components/ui/kpi-ticker";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronLeft, Radio, Play, Pause, Volume2, VolumeX, Sparkles } from "lucide-react";
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
import Link from "next/link";

function PlantMap({ plants }: { plants: PlantInfo[] }) {
  // Coordinates mapping on the world map layout (Asia / Indo-Pacific focus)
  const coords: Record<string, { x: string; y: string; name: string }> = {
    PNQ: { x: "28%", y: "46%", name: "Pune (PNQ)" },
    RYG: { x: "56%", y: "54%", name: "Rayong (RYG)" },
    NGO: { x: "78%", y: "34%", name: "Nagoya (NGO)" },
  };

  return (
    <div className="relative w-full h-full bg-base-200 border border-base-300 rounded-xl overflow-hidden shadow-sm">
      {/* Background Geo Grid & Flow Lines */}
      <div className="absolute inset-0">
        <svg viewBox="0 0 1000 500" className="w-full h-full opacity-[0.09]" preserveAspectRatio="none">
          <ellipse cx="500" cy="250" rx="460" ry="220" stroke="white" strokeWidth="1" fill="none" />
          <ellipse cx="500" cy="250" rx="340" ry="160" stroke="white" strokeWidth="0.5" fill="none" />
          <ellipse cx="500" cy="250" rx="180" ry="80" stroke="white" strokeWidth="0.5" fill="none" />
          <line x1="500" y1="20" x2="500" y2="480" stroke="white" strokeWidth="0.5" />
          <line x1="40" y1="250" x2="960" y2="250" stroke="white" strokeWidth="0.5" />
          {/* Supply flow arcs: Taiwan -> Nagoya, Taiwan -> Pune */}
          <path d="M 680 180 Q 730 160 780 170" stroke="#7c8fff" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.6" />
          <path d="M 680 180 Q 480 180 280 230" stroke="#7c8fff" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.4" />
          <path d="M 560 270 Q 420 270 280 230" stroke="#3ecf8e" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.4" />
        </svg>
      </div>

      {/* Supplier Hubs */}
      <div className="absolute group cursor-pointer" style={{ left: "68%", top: "36%" }}>
        <div className="w-2 h-2 rounded-full border border-sky-400 bg-sky-400/40" />
        <span className="text-[9px] font-mono text-base-content/50 ml-1.5 whitespace-nowrap hidden sm:inline">
          ◌ TPE (Tier-1)
        </span>
      </div>
      <div className="absolute group cursor-pointer" style={{ left: "54%", top: "58%" }}>
        <div className="w-2 h-2 rounded-full border border-sky-400 bg-sky-400/40" />
        <span className="text-[9px] font-mono text-base-content/50 ml-1.5 whitespace-nowrap hidden sm:inline">
          ◌ PEN (Alt)
        </span>
      </div>

      {plants.map((p) => {
        const info = coords[p.id] || { x: "50%", y: "50%", name: p.name };
        const isWarning =
          p.status === "warning" ||
          p.status === "attention" ||
          p.status === "ATTENTION_REQUIRED" ||
          (p.active_anomalies && p.active_anomalies > 0);

        return (
          <div key={p.id} className="absolute group cursor-pointer" style={{ left: info.x, top: info.y }}>
            <div className="relative flex items-center">
              <div
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-300 relative z-10",
                  isWarning ? "bg-[#e8a838] pulse-warn ring-4 ring-[#e8a838]/20" : "bg-[#3ecf8e] ring-4 ring-[#3ecf8e]/20"
                )}
              />
              <div className="ml-2 bg-base-300/80 backdrop-blur-sm border border-base-content/10 px-2 py-0.5 rounded text-[10px] font-medium text-base-content shadow whitespace-nowrap flex items-center gap-1">
                <span>{p.flag}</span>
                <span>{p.id}</span>
                {isWarning && <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />}
              </div>
            </div>

            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
              <div className="bg-base-300 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl border border-base-content/10">
                <p className="font-semibold text-base-content">
                  {p.flag ? `${p.flag} ` : ""}{p.name} ({p.id})
                </p>
                <p className="text-base-content/60 text-[11px] mt-0.5">
                  Status: {isWarning ? "Attention Required" : "Normal Operation"}
                </p>
                {p.timezone && (
                  <p className="text-base-content/40 text-[10px]">{p.timezone}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Disruption beacon - Typhoon Haikui-2 */}
      <div className="absolute" style={{ left: "69%", top: "33%" }}>
        <div className="w-8 h-8 rounded-full border border-violet-400/40 animate-ping opacity-25" />
        <div className="absolute inset-0 flex items-center justify-center text-sm">🌀</div>
        <div className="absolute left-6 top-0 bg-violet-950/80 border border-violet-500/30 rounded px-1.5 py-0.5 text-[9px] text-violet-200 font-mono whitespace-nowrap">
          Typhoon Alert
        </div>
      </div>

      {/* Legend & Controls */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-base-content/50 bg-base-300/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-base-content/5">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3ecf8e] inline-block" /> Running Plant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#e8a838] inline-block" /> Warning
          </span>
          <span className="flex items-center gap-1.5 text-violet-400">
            🌀 Disruption Event
          </span>
          <span className="flex items-center gap-1.5 text-sky-400 hidden sm:inline-flex">
            ◌ Tier-1 Supply Node
          </span>
        </div>
        <span className="font-mono text-[9px] text-base-content/40 hidden md:inline">
          LIVE DIGITAL TWIN
        </span>
      </div>
    </div>
  );
}

function EventStream({ insights }: { insights: InsightItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const severityDot: Record<string, string> = {
    critical: "bg-[#e05c5c]",
    high: "bg-[#e8a838]",
    medium: "bg-[#e8a838]/60",
    low: "bg-[#5b73ff]",
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused || insights.length <= 2) return;

    const interval = setInterval(() => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ top: 60, behavior: "smooth" });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused, insights.length]);

  if (!insights || insights.length === 0) {
    return <div className="p-4 text-xs text-base-content/40 text-center">No active anomalies</div>;
  }

  return (
    <div
      ref={scrollRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="divide-y divide-white/[0.05] overflow-y-auto h-full max-h-[250px] scroll-smooth pr-1 select-none"
    >
      {insights.map((ins) => (
        <Link
          key={ins.id}
          href={ins.domain === "maintenance" ? "/asset-health" : "/war-room"}
          className="flex gap-2.5 py-2 hover:bg-white/[0.03] cursor-pointer transition-colors group first:pt-0 last:pb-0 px-1 rounded-lg"
        >
          <div className="mt-1 shrink-0">
            <span className={cn("w-1.5 h-1.5 rounded-full inline-block", severityDot[ins.severity] || "bg-[#5b73ff]")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-base-content truncate">{ins.title}</span>
              {ins.id === "ins_002" && <Badge variant="scenario">SCENARIO</Badge>}
            </div>
            <p className="text-[11px] text-base-content/50 mt-0.5 line-clamp-1">{ins.summary}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-base-content/60 font-mono">{ins.agent}</span>
              {ins.impact?.usd && ins.impact.usd > 0 ? (
                <span className="text-[10px] text-warning font-medium">
                  ${(ins.impact.usd / 1000).toFixed(0)}k at risk
                </span>
              ) : null}
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-base-content/30 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}

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
  // [MOCK DISABLED] Initialized to null to rely purely on live /v1/kpis
  const [kpis, setKpis] = useState<KpiDataPayload["kpis"] | null>(null);
  const [plants, setPlants] = useState<PlantInfo[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  // [MOCK DISABLED] Initialized to null to rely purely on live /v1/value-ledger
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

        {/* Right Column (4 cols): Live Event Stream + Value Ledger stacked */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          {/* Live Event Stream - Connected to /v1/insights?status=new */}
          <Card className="h-[310px] flex flex-col">
            <CardHeader className="py-2.5 px-4 shrink-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Radio className="w-3 h-3 text-[#3ecf8e]" />
                Live Event Stream
              </CardTitle>
              <span className="text-[10px] text-[#4e5668] flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] inline-block animate-pulse" />
                live ({filteredInsights.length})
              </span>
            </CardHeader>
            <div className="px-4 pb-3 flex-1 min-h-0 overflow-hidden">
              <EventStream insights={filteredInsights} />
            </div>
          </Card>

          {/* Value Ledger - Connected to /v1/value-ledger */}
          <Card className="h-[250px] flex flex-col justify-between">
            <CardHeader className="py-2.5 px-4 shrink-0">
              <CardTitle className="text-sm">Value Ledger</CardTitle>
              <Badge variant="scenario">{valueLedger ? "LIVE GATEWAY" : "LOADING"}</Badge>
            </CardHeader>
            <div className="space-y-3 px-4 pb-3 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-2xl font-semibold tabular text-base-content">
                  {valueLedger ? `$${(valueLedger.total_usd / 1000000).toFixed(2)}M` : "--"}
                </p>
                <p className="text-[10px] text-base-content/40 mt-0.5">value protected this quarter</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-base-300 rounded-lg p-2.5">
                  <p className="text-base font-semibold tabular text-base-content">
                    {valueLedger ? `${valueLedger.downtime_h_avoided}h` : "--"}
                  </p>
                  <p className="text-[10px] text-base-content/40 mt-0.5">downtime avoided</p>
                </div>
                <div className="bg-base-300 rounded-lg p-2.5">
                  <p className="text-base font-semibold tabular text-success">
                    {valueLedger ? `${Math.round(valueLedger.co2_kg_saved / 1000)}t` : "--"}
                  </p>
                  <p className="text-[10px] text-base-content/40 mt-0.5">CO₂e saved</p>
                </div>
              </div>
              {valueLedger?.entries && valueLedger.entries.length > 0 && (
                <div className="divide-y divide-white/[0.05]">
                  {valueLedger.entries.slice(0, 2).map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-[11px] py-1.5 first:pt-0 last:pb-0">
                      <span className="text-base-content/40 truncate flex-1">{e.description}</span>
                      <span className="text-success ml-2 shrink-0 font-medium">
                        +${(e.est_usd / 1000).toFixed(0)}k
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
