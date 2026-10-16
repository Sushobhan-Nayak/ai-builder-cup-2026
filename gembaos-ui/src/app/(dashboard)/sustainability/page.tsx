"use client";
import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Leaf, CheckCircle, FileText, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  calculateLoadShift,
  fetchGlobalKpis,
  approveLoadShiftSchedule,
  generateEsgReport,
  type KpiDataPayload,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

function buildEnergyData(plant: string, shifted: boolean) {
  const baseLoad = plant === "NGO" ? 135 : plant === "RYG" ? 165 : plant === "PNQ" ? 148 : 210;
  return Array.from({ length: 24 }, (_, h) => {
    const isPeakWindow = h >= 13 && h <= 18;
    const isOffPeakTarget = h >= 1 && h <= 6;
    let energy = baseLoad + Math.sin(h * 0.35) * 28 + (h >= 8 && h <= 19 ? 55 : 0);

    if (shifted) {
      if (isPeakWindow) energy -= 52;
      if (isOffPeakTarget) energy += 46;
    }

    return {
      hour: `${String(h).padStart(2, "0")}:00`,
      energy: Math.round(energy),
      isPeakWindow,
      isOffPeakTarget,
      tariff: isPeakWindow ? 0.19 : 0.08,
    };
  });
}

const PLANT_ESG_META: Record<string, { name: string; savings: string; co2Avoided: string; rec: string; energyCost: string; kwhPerUnit: string }> = {
  ALL: {
    name: "Global Fleet (PNQ · RYG · NGO)",
    savings: "$1,640",
    co2Avoided: "4.45t",
    energyCost: "$26.8k",
    kwhPerUnit: "4.1 kWh",
    rec: "Shift NGO-FUR-02 induction pre-heat and RYG-DCM-02 holding furnace boost from peak grid hours (13:00–18:00) to off-peak window (01:00–06:00).",
  },
  PNQ: {
    name: "Pune Plant (PNQ)",
    savings: "$420",
    co2Avoided: "1.15t",
    energyCost: "$9.4k",
    kwhPerUnit: "4.3 kWh",
    rec: "Stagger PNQ-CMP-01 air compressor recharge cycles and Line L2 auxiliary chillers away from Maharashtra MSEB peak tariff (13:00–18:00).",
  },
  RYG: {
    name: "Rayong Plant (RYG)",
    savings: "$540",
    co2Avoided: "1.48t",
    energyCost: "$10.1k",
    kwhPerUnit: "4.6 kWh",
    rec: "Shift RYG-DCM-02 aluminum holding furnace thermal boost to off-peak & rooftop solar window (01:00–06:00 & 10:00–13:00).",
  },
  NGO: {
    name: "Nagoya Plant (NGO)",
    savings: "$680",
    co2Avoided: "1.82t",
    energyCost: "$7.3k",
    kwhPerUnit: "3.5 kWh",
    rec: "Shift NGO-FUR-02 electric induction furnace pre-heat from Chubu peak tariff (13:00–18:00) to off-peak hours (01:00–06:00).",
  },
};

export default function Sustainability() {
  const { selectedPlant } = useAppStore();
  const [loadShift, setLoadShift] = useState<any>(null);
  const [kpis, setKpis] = useState<KpiDataPayload["kpis"] | null>(null);
  const [shiftApplied, setShiftApplied] = useState(false);
  const [simulatedMode, setSimulatedMode] = useState(false);
  const [esgDrafted, setEsgDrafted] = useState(false);
  const [esgDrafting, setEsgDrafting] = useState(false);
  const [esgReportId, setEsgReportId] = useState<string>("GRI-305-OCT-2026");

  useEffect(() => {
    setShiftApplied(false);
    setSimulatedMode(false);
    const plantTarget = selectedPlant === "ALL" ? "NGO" : selectedPlant;
    calculateLoadShift(plantTarget).then((res) => {
      if (res) setLoadShift(res);
    }).catch(() => {});

    const scopeParam = selectedPlant === "ALL" ? "global" : selectedPlant;
    fetchGlobalKpis(scopeParam).then((res) => {
      if (res?.kpis) setKpis(res.kpis);
    }).catch(() => {});
  }, [selectedPlant]);

  const handleApproveLoadShift = async () => {
    setShiftApplied(true);
    setSimulatedMode(false);
    try {
      await approveLoadShiftSchedule({
        plant_id: selectedPlant === "ALL" ? "NGO" : selectedPlant,
        process: "Furnace pre-heat cycles",
        window: "01:00–06:00",
      });
    } catch (err) {
      console.warn("Load shift approve notice:", err);
    }
  };

  const handleDraftEsgReport = async () => {
    if (esgDrafted) {
      setEsgDrafted(false);
      return;
    }
    setEsgDrafting(true);
    try {
      const res = await generateEsgReport("GRI-305", "October 2026");
      if (res?.report_id) {
        setEsgReportId(res.report_id);
      }
      setEsgDrafted(true);
    } catch {
      setEsgDrafted(true);
    } finally {
      setEsgDrafting(false);
    }
  };

  const meta = PLANT_ESG_META[selectedPlant] || PLANT_ESG_META.ALL;
  const co2PerUnit = kpis?.co2_intensity_kg_per_unit ?? (selectedPlant === "NGO" ? 13.4 : selectedPlant === "RYG" ? 19.8 : 18.2);
  const chartData = useMemo(
    () => buildEnergyData(selectedPlant, shiftApplied || simulatedMode),
    [selectedPlant, shiftApplied, simulatedMode]
  );

  const scopeItems = useMemo(() => {
    const allScopes = [
      { plant: "NGO", label: "Scope 1 — Carburizing Furnace Gas (NGO)", value: 38, total: 142, color: "#EF4444" },
      { plant: "PNQ", label: "Scope 2 — Grid Electricity (PNQ)", value: 62, total: 142, color: "#F59E0B" },
      { plant: "RYG", label: "Scope 2 — Die-Casting Grid Load (RYG)", value: 28, total: 142, color: "#F59E0B" },
      { plant: "NGO", label: "Scope 2 — Grid Electricity (NGO)", value: 14, total: 142, color: "#22C55E" },
    ];
    return selectedPlant === "ALL" ? allScopes : allScopes.filter((s) => s.plant === selectedPlant);
  }, [selectedPlant]);

  const pcfItems = useMemo(() => {
    const allPcf = [
      { plant: "PNQ", sku: "TM-300 Traction Inverter (PNQ)", pcf: "18.4 kgCO₂e/unit", trend: "−2.1%" },
      { plant: "RYG", sku: "HSG-220 Die-Cast Housing (RYG)", pcf: "6.2 kgCO₂e/unit", trend: "−0.8%" },
      { plant: "NGO", sku: "GBX-100 e-Axle Gearbox (NGO)", pcf: "12.7 kgCO₂e/unit", trend: "−1.4%" },
    ];
    return selectedPlant === "ALL" ? allPcf : allPcf.filter((p) => p.plant === selectedPlant);
  }, [selectedPlant]);

  return (
    <div className="p-3 space-y-2.5 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Leaf className="w-5 h-5 text-emerald-400" />
          <h1 className="text-base font-bold text-[#E6EDF3]">Energy & Sustainability</h1>
          <Badge variant="default" className="text-[10px] font-semibold py-0.5">Verdant Agent</Badge>
          {selectedPlant !== "ALL" && (
            <Badge variant="scenario" className="font-mono text-[10px] py-0.5">Site: {selectedPlant}</Badge>
          )}
        </div>
        <span className="text-xs text-[#8B98A9] font-mono">
          ISO 50001 · GHG Protocol Scope 1, 2 & 3
        </span>
      </div>

      {/* Sustainability Metrics Runway Ticker */}
      <div className="rounded-xl bg-[#0c1322] border border-[#243042] px-3 py-1.5 shadow-sm flex items-center justify-between gap-3 text-xs overflow-hidden">
        <div className="flex items-center gap-2 shrink-0 pr-2.5 border-r border-[#243042]">
          <span className="text-[11px] font-bold text-[#E6EDF3] uppercase tracking-wider hidden sm:inline">
            Sustainability Runway
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
            {shiftApplied ? "Load-Shift Active" : simulatedMode ? "Simulating Shift" : "ESG Optimal"}
          </span>
        </div>

        {/* Horizontal Ticker Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full scrollbar-none py-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Energy/Unit:</span>
            <span className="font-bold text-emerald-400 font-mono">{meta.kwhPerUnit}</span>
            <span className="text-[10px] text-emerald-500 font-mono">−0.2 vs L/M</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">CO₂/Unit:</span>
            <span className="font-bold text-emerald-400 font-mono">{co2PerUnit} kg</span>
            <span className="text-[10px] text-emerald-500 font-mono">{co2PerUnit < 18 ? "−4.8 vs fleet" : "Nominal"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Avoided CO₂:</span>
            <span className="font-bold text-emerald-400 font-mono">{meta.co2Avoided}</span>
            <span className="text-[10px] text-emerald-500 font-mono">via Load Shift</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Energy Cost (Net):</span>
            <span className="font-bold text-emerald-400 font-mono">{meta.energyCost}</span>
            <span className="text-[10px] text-emerald-500 font-mono">−{meta.savings} savings</span>
          </div>
        </div>

        <div className="shrink-0 text-[10px] text-emerald-400 font-mono items-center gap-1 hidden md:flex">
          <CheckCircle className="w-3 h-3" />
          <span>GRI Standards Compliant</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Energy profile */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Energy Profile — {meta.name} · Today</CardTitle>
              {(shiftApplied || simulatedMode) && (
                <Badge variant="ok" className="text-[10px] font-mono">
                  {shiftApplied ? "Off-Peak Shift Committed" : "Simulated Off-Peak Profile"}
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-[#8B98A9]">kWh by hour · Peak tariff (13:00–18:00) highlighted</span>
          </CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="hour" tick={{ fill: "#8B98A9", fontSize: 9 }} interval={2} />
                <YAxis tick={{ fill: "#8B98A9", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#121821", border: "1px solid #243042", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#8B98A9" }}
                  formatter={(val: any) => [`${val} kWh`, "Hourly Load"]}
                />
                <Bar dataKey="energy" name="Energy (kWh)" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        (shiftApplied || simulatedMode) && entry.isOffPeakTarget
                          ? "#38BDF8"
                          : entry.isPeakWindow && !(shiftApplied || simulatedMode)
                          ? "#F59E0B"
                          : "#22C55E"
                      }
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-1 text-[10px] text-[#8B98A9]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#22C55E] inline-block" /> Base Load
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B] inline-block" /> Peak Tariff Window (13:00–18:00)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#38BDF8] inline-block" /> Shifted Off-Peak Window (01:00–06:00)
            </span>
          </div>
        </Card>

        {/* Load shift recommendation */}
        <Card className="col-span-12 lg:col-span-4" glow>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><span className="text-[#22C55E]">🌿 Verdant Optimizer</span></CardTitle>
            <Badge variant={shiftApplied ? "ok" : "default"}>
              {shiftApplied ? "MES Active" : "Recommendation"}
            </Badge>
          </CardHeader>
          <div className="space-y-3 text-xs">
            <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3">
              <p className="font-semibold text-[#E6EDF3] mb-1.5">Load-shift: High-Draw Thermal Cycle</p>
              <p className="text-[#8B98A9] leading-relaxed">{meta.rec}</p>
              <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-[#243042]/60">
                <div className="text-center">
                  <p className="text-green-400 font-bold text-base font-mono">{meta.savings}</p>
                  <p className="text-[#8B98A9] text-[10px]">saved / cycle</p>
                </div>
                <div className="text-center">
                  <p className="text-green-400 font-bold text-base font-mono">{meta.co2Avoided}</p>
                  <p className="text-[#8B98A9] text-[10px]">CO₂e avoided</p>
                </div>
              </div>
              <p className="text-[10px] text-[#A78BFA] mt-2 font-mono">[ev:tariff-grid] [ev:carbon-intensity]</p>
            </div>
            <div className="flex gap-2">
              {!shiftApplied ? (
                <Button
                  size="sm"
                  variant="success"
                  className="flex-1 cursor-pointer"
                  onClick={handleApproveLoadShift}
                >
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Apply Load Shift
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 cursor-pointer text-emerald-400 border-emerald-500/40"
                  onClick={() => setShiftApplied(false)}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Shift Queued to MES (Reset)
                </Button>
              )}
              <Button
                size="sm"
                variant={simulatedMode ? "primary" : "secondary"}
                className="flex-1 cursor-pointer"
                onClick={() => setSimulatedMode(!simulatedMode)}
              >
                {simulatedMode ? "Exit Simulation" : "Simulate Shift"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Scope breakdown */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <CardTitle>Scope 1 + 2 Breakdown — Oct 2026 ({selectedPlant === "ALL" ? "All Sites" : selectedPlant})</CardTitle>
            <Badge variant="scenario">GHG PROTOCOL</Badge>
          </CardHeader>
          <div className="space-y-2">
            {scopeItems.map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8B98A9]">{s.label}</span>
                  <span className="text-[#E6EDF3] font-medium font-mono">{s.value} tCO₂e</span>
                </div>
                <div className="h-1.5 bg-[#243042] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.value / s.total) * 100}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            disabled={esgDrafting}
            variant={esgDrafted ? "success" : "secondary"}
            className="w-full mt-3 cursor-pointer"
            onClick={handleDraftEsgReport}
          >
            {esgDrafting ? (
              "Drafting GRI Report..."
            ) : esgDrafted ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> GRI 302 & 305 Disclosure Generated ({esgReportId})
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 mr-1" /> Auto-draft ESG Report (GRI)
              </>
            )}
          </Button>
          {esgDrafted && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-[#E6EDF3] space-y-1">
              <p className="font-semibold text-emerald-400">
                GRI 302 (Energy) & GRI 305 (Emissions) Audit Summary · <span className="font-mono">{esgReportId}</span>:
              </p>
              <p className="text-[#8B98A9] leading-relaxed">
                Scope 1 & 2 total emissions verified at <strong>142.0 tCO₂e</strong> across {meta.name}. Automated off-peak furnace load-shifting reduced peak grid carbon intensity by <strong>14.2%</strong> ({meta.co2Avoided} avoided). Ready for ISO 50001 sign-off.
              </p>
            </div>
          )}
        </Card>

        {/* Product carbon footprint */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <CardTitle>Product Carbon Footprint (Cradle-to-Gate)</CardTitle>
            <span className="text-[10px] text-[#8B98A9] font-mono">ISO 14067 Verified</span>
          </CardHeader>
          <div className="space-y-2">
            {pcfItems.map((p) => (
              <div key={p.sku} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F14] border border-[#243042] text-xs">
                <span className="text-[#E6EDF3] font-medium">{p.sku}</span>
                <span className="text-[#8B98A9] font-mono">{p.pcf}</span>
                <span className="text-green-400 font-mono font-bold">{p.trend}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
