"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Leaf, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { calculateLoadShift } from "@/lib/api-client";

const energyData = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h}:00`,
  energy: 120 + Math.sin(h * 0.4) * 40 + (h >= 8 && h <= 18 ? 60 : 0) + Math.random() * 10,
  tariff: h >= 8 && h <= 20 ? 0.18 : 0.09,
  carbon: h >= 8 && h <= 20 ? 0.42 : 0.33,
}));

export default function Sustainability() {
  const [loadShift, setLoadShift] = useState<any>(null);

  useEffect(() => {
    calculateLoadShift("NGO").then((res) => {
      if (res) setLoadShift(res);
    });
  }, []);

  const savings = loadShift?.savings_usd ? `$${loadShift.savings_usd}` : "$3.1k";
  const co2Avoided = loadShift?.co2_avoided_tons ? `${loadShift.co2_avoided_tons}t` : "4.6t";
  const recText = loadShift?.recommendation || "Move NGO furnace pre-heat cycles from 08:00–10:00 to 02:00–05:00.";

  return (
    <div className="p-3 space-y-2.5 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Leaf className="w-5 h-5 text-emerald-400" />
          <h1 className="text-base font-bold text-[#E6EDF3]">Energy & Sustainability</h1>
          <Badge variant="default" className="text-[10px] font-semibold py-0.5">Verdant Agent</Badge>
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
            ESG Optimal
          </span>
        </div>

        {/* Horizontal Ticker Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full scrollbar-none py-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Energy/Unit:</span>
            <span className="font-bold text-emerald-400 font-mono">4.1 kWh</span>
            <span className="text-[10px] text-emerald-500 font-mono">−0.2 vs L/M</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">CO₂/Unit:</span>
            <span className="font-bold text-emerald-400 font-mono">1.9 kg</span>
            <span className="text-[10px] text-emerald-500 font-mono">−0.1 vs L/M</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Scope 1+2 (Oct):</span>
            <span className="font-bold text-emerald-400 font-mono">142 tCO₂e</span>
            <span className="text-[10px] text-emerald-500 font-mono">−8% vs L/M</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Energy Cost (Oct):</span>
            <span className="font-bold text-emerald-400 font-mono">$28.4k</span>
            <span className="text-[10px] text-emerald-500 font-mono">−$3.1k vs L/M</span>
          </div>
        </div>

        <div className="shrink-0 text-[10px] text-emerald-400 font-mono flex items-center gap-1 hidden md:flex">
          <CheckCircle className="w-3 h-3" />
          <span>GRI Standards Compliant</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Energy profile */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <CardTitle>Energy Profile — Nagoya Plant · Today</CardTitle>
            <span className="text-[10px] text-[#8B98A9]">kWh by hour · tariff overlay</span>
          </CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="hour" tick={{ fill: "#8B98A9", fontSize: 9 }} interval={3} />
                <YAxis tick={{ fill: "#8B98A9", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#121821", border: "1px solid #243042", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#8B98A9" }}
                />
                <Bar dataKey="energy" fill="#22C55E" opacity={0.7} name="Energy (kWh)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Load shift recommendation */}
        <Card className="col-span-12 lg:col-span-4" glow>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><span className="text-[#22C55E]">🌿 Verdant</span></CardTitle>
            <Badge variant="ok">Recommendation</Badge>
          </CardHeader>
          <div className="space-y-3 text-xs">
            <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3">
              <p className="font-semibold text-[#E6EDF3] mb-1.5">Load-shift: Furnace pre-heat</p>
              <p className="text-[#8B98A9]">{recText}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-center">
                  <p className="text-green-400 font-bold text-base">{savings}</p>
                  <p className="text-[#8B98A9] text-[10px]">saved/month</p>
                </div>
                <div className="text-center">
                  <p className="text-green-400 font-bold text-base">{co2Avoided}</p>
                  <p className="text-[#8B98A9] text-[10px]">CO₂e saved/month</p>
                </div>
              </div>
              <p className="text-[10px] text-[#A78BFA] mt-2">[ev:tariff-1] [ev:carbon-feed-1]</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="success"
                className="flex-1"
                onClick={async () => {
                  try {
                    const res = await calculateLoadShift("NGO");
                    setLoadShift(res);
                  } catch (e) {
                    console.warn(e);
                  }
                }}
              >
                <CheckCircle className="w-3 h-3" />
                Apply Load Shift
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={async () => {
                  const res = await calculateLoadShift("NGO");
                  setLoadShift(res);
                }}
              >
                Simulate Shift
              </Button>
            </div>
          </div>
        </Card>

        {/* Scope breakdown */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <CardTitle>Scope 1 + 2 Breakdown — Oct 2026</CardTitle>
            <Badge variant="scenario">SIMULATED</Badge>
          </CardHeader>
          <div className="space-y-2">
            {[
              { label: "Scope 1 — Furnace gas (NGO)", value: 38, total: 142, color: "#EF4444" },
              { label: "Scope 2 — Grid electricity (PNQ)", value: 62, total: 142, color: "#F59E0B" },
              { label: "Scope 2 — Grid electricity (RYG)", value: 28, total: 142, color: "#F59E0B" },
              { label: "Scope 2 — Grid electricity (NGO)", value: 14, total: 142, color: "#F59E0B" },
            ].map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8B98A9]">{s.label}</span>
                  <span className="text-[#E6EDF3] font-medium">{s.value} tCO₂e</span>
                </div>
                <div className="h-1.5 bg-[#243042] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.value / s.total) * 100}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="secondary" className="w-full mt-3">Auto-draft ESG Report (GRI)</Button>
        </Card>

        {/* Product carbon footprint */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <CardTitle>Product Carbon Footprint (cradle-to-gate)</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {[
              { sku: "TM-300 Motor Assembly", pcf: "18.4 kgCO₂e/unit", trend: "−2.1%" },
              { sku: "HSG-220 Motor Housing", pcf: "6.2 kgCO₂e/unit", trend: "−0.8%" },
              { sku: "GBX-100 e-Axle Gearbox", pcf: "12.7 kgCO₂e/unit", trend: "−1.4%" },
            ].map((p) => (
              <div key={p.sku} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0F14] border border-[#243042] text-xs">
                <span className="text-[#E6EDF3]">{p.sku}</span>
                <span className="text-[#8B98A9]">{p.pcf}</span>
                <span className="text-green-400">{p.trend}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
