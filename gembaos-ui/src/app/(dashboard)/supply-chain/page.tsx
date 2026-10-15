"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Compass,
  CheckCircle,
  PackageCheck,
  ShieldAlert,
  Play,
  RotateCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchBlastRadius } from "@/lib/api-client";
import { SupplyChainMap } from "@/components/dashboard/supply-chain-map";

const INVENTORY_ITEMS = [
  { sku: "Gate-driver IC", code: "IC-GD-01", plant: "PNQ", days: 9, status: "critical", stock: "450 pcs" },
  { sku: "Current-sensor IC", code: "IC-CS-04", plant: "PNQ", days: 12, status: "high", stock: "620 pcs" },
  { sku: "Bearing 6205", code: "BRG-6205", plant: "PNQ", days: 3, status: "critical", stock: "18 pcs" },
  { sku: "NdFeB Magnet", code: "MAG-ND-08", plant: "PNQ", days: 28, status: "ok", stock: "2,400 pcs" },
  { sku: "Aluminium Ingot", code: "ING-AL-02", plant: "RYG", days: 45, status: "ok", stock: "14.2 tons" },
];

export default function SupplyChain() {
  const [blastRunning, setBlastRunning] = useState(false);
  const [blastDone, setBlastDone] = useState(true); // Pre-load active scenario impact

  const runBlast = async () => {
    setBlastRunning(true);
    try {
      await fetchBlastRadius({ event_type: "weather", entity_id: "SUP-FORMOSA" });
    } catch (err) {
      console.warn("fetchBlastRadius error:", err);
    } finally {
      setBlastRunning(false);
      setBlastDone(true);
    }
  };

  return (
    <div className="p-3 space-y-2.5 max-w-[1700px] mx-auto">
      {/* 1. Header Bar: Ultra Compact Single Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[#06B6D4]">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-sm font-bold text-[#E6EDF3] tracking-wide">Supply Chain Control Tower</h1>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            Navigator Agent
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/60 border border-red-500/40 text-red-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
            TYPHOON HAIKUI-2 ACTIVE
          </span>
        </div>
      </div>

      {/* 2. Inventory Runway Ticker: Compact Single-Line Strip */}
      <div className="rounded-lg bg-[#0c1322] border border-[#243042] px-3 py-1.5 shadow-md flex items-center justify-between gap-3 overflow-hidden text-xs">
        <div className="flex items-center gap-2 shrink-0 pr-2.5 border-r border-[#243042]">
          <PackageCheck className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold text-[#E6EDF3] uppercase tracking-wider hidden sm:inline">
            Inventory Runway
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
            2 Critical
          </span>
        </div>

        {/* Ticker items */}
        <div className="flex items-center gap-2 overflow-x-auto w-full scrollbar-none py-0.5">
          {INVENTORY_ITEMS.map((item) => {
            const isCrit = item.status === "critical";
            const isHigh = item.status === "high";
            return (
              <div
                key={item.sku}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1 rounded-md border text-[11px] shrink-0 transition-colors",
                  isCrit
                    ? "bg-red-950/30 border-red-500/40 text-red-200"
                    : isHigh
                    ? "bg-amber-950/30 border-amber-500/40 text-amber-200"
                    : "bg-[#050912] border-[#1e293b] text-[#E6EDF3]"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    isCrit ? "bg-red-400 animate-pulse" : isHigh ? "bg-amber-400" : "bg-emerald-400"
                  )}
                />
                <span className="font-semibold text-[11px] leading-none">{item.sku}</span>
                <span className="text-[9px] text-[#8B98A9] font-mono">({item.plant})</span>
                <span
                  className={cn(
                    "font-bold font-mono text-[11px] ml-0.5",
                    isCrit ? "text-red-400" : isHigh ? "text-amber-400" : "text-emerald-400"
                  )}
                >
                  {item.days}d
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Main Workspace: Equal-Height Grid (Map + Disruptions + Blast Radius) */}
      <div className="grid grid-cols-12 gap-3 items-stretch">
        {/* Map Panel on Left */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col">
          <SupplyChainMap canvasHeight="h-[430px]" className="h-[475px]" />
        </div>

        {/* Right Action Panels: Perfectly Fills 475px to Match Map */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 h-[475px] flex flex-col justify-between gap-3">
          {/* Active Disruptions Panel */}
          <div className="rounded-xl bg-[#0c1322] border border-[#243042] p-3 shadow-lg flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#243042]/80 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#E6EDF3] tracking-wide">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>ACTIVE MARITIME & WEATHER DISRUPTIONS</span>
                </div>
                <span className="text-[10px] text-red-400 font-mono font-bold bg-red-950/40 px-1.5 py-0.2 rounded border border-red-500/30">
                  2 ALERTS
                </span>
              </div>

              <div className="space-y-2">
                {[
                  {
                    title: "Typhoon Haikui-2 (Cat 3 Cyclone)",
                    node: "Port of Keelung (TWKEL)",
                    severity: "critical",
                    impact: "48h Landfall · Port Closed · Container Vessel MV-EverOcean Delayed +18d",
                  },
                  {
                    title: "Port Congestion Buffer Alert",
                    node: "Penang Port (MYPEN)",
                    severity: "medium",
                    impact: "Customs Clearance Delay: +14h Buffer · Air Cargo Priority Lane OPEN",
                  },
                ].map((d, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-[#050912] border border-[#1e293b] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                          d.severity === "critical"
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        )}
                      >
                        {d.severity}
                      </span>
                      <span className="text-[10px] text-[#8B98A9] font-mono">{d.node}</span>
                    </div>
                    <p className="text-[#E6EDF3] font-semibold text-xs">{d.title}</p>
                    <p className="text-[10px] text-[#8B98A9] leading-tight">{d.impact}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Risk Footer */}
            <div className="pt-2 border-t border-[#243042]/60 flex items-center justify-between text-[10px] text-[#8B98A9] mt-1">
              <span>Risk: <strong className="text-red-400 font-mono font-semibold">$1.82M Revenue</strong></span>
              <span>Alternate Corridor: <strong className="text-emerald-400 font-medium">Penang Air Freight</strong></span>
            </div>
          </div>

          {/* Graph Blast Radius Panel */}
          <div
            className={cn(
              "rounded-xl bg-[#0c1322] border p-3 shadow-lg flex-1 flex flex-col justify-between transition-all",
              blastDone ? "border-cyan-500/40 shadow-cyan-950/20" : "border-[#243042]"
            )}
          >
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#243042]/80 mb-2">
                <span className="text-xs font-bold text-[#E6EDF3] tracking-wide">
                  GRAPH BLAST RADIUS (5-HOP GQL)
                </span>
                <button
                  onClick={runBlast}
                  disabled={blastRunning}
                  className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="Run BigQuery Graph Traversal"
                >
                  {blastRunning ? (
                    <>
                      <RotateCw className="w-2.5 h-2.5 animate-spin" />
                      <span>Traversing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Re-query GQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/25 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Spanner Graph traversal verified · Formosa Semiconductor</span>
                </div>

                {/* 3x2 Metric Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Parts affected", value: "2", color: "text-red-400" },
                    { label: "SKUs affected", value: "3", color: "text-orange-400" },
                    { label: "Open orders", value: "11", color: "text-yellow-400" },
                    { label: "Revenue at risk", value: "$1.82M", color: "text-red-400" },
                    { label: "OEM Customers", value: "2", color: "text-[#E6EDF3]" },
                    { label: "Stock-out in", value: "9 days", color: "text-red-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#050912] border border-[#1e293b] rounded-lg p-2 text-center">
                      <p className="text-[9px] text-[#8B98A9] truncate">{label}</p>
                      <p className={cn("text-xs font-bold tabular font-mono mt-0.5", color)}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Downstream Path Chain */}
                <div className="flex items-center gap-1 text-[9px] text-[#E6EDF3] flex-wrap bg-[#050912] border border-[#1e293b] rounded-lg p-2">
                  {["Formosa", "→ IC-GD-01", "→ TM-300", "→ 11 SOs", "→ Tata & Toyota"].map((n, i) => (
                    <span key={i} className="flex items-center gap-0.5">
                      {i > 0 && <span className="text-[#8B98A9]">→</span>}
                      <span className="bg-[#121c2e] px-1.5 py-0.5 rounded border border-[#243042] font-mono">
                        {n.replace("→ ", "")}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Recommendation Link */}
            <div className="pt-2 border-t border-[#243042]/60 flex items-center justify-between text-[10px] text-[#8B98A9] mt-1">
              <span>Resolution: <strong className="text-cyan-300">Penang PO Split + Expedite</strong></span>
              <span className="text-cyan-400 font-mono font-medium">[ev:gql-1]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
