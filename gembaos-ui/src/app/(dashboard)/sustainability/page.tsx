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
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Leaf className="w-5 h-5 text-[#22C55E]" />
        <h1 className="text-lg font-bold text-[#E6EDF3]">Energy & Sustainability</h1>
        <Badge variant="default">Verdant Agent</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Energy/Unit", value: "4.1 kWh", delta: "−0.2", ok: true },
          { label: "CO₂/Unit", value: "1.9 kg", delta: "−0.1", ok: true },
          { label: "Scope 1+2 (Oct)", value: "142 tCO₂e", delta: "−8%", ok: true },
          { label: "Energy Cost (Oct)", value: "$28.4k", delta: "−$3.1k", ok: true },
        ].map((k) => (
          <div key={k.label} className="bg-[#121821] border border-[#243042] rounded-xl p-3">
            <p className="text-[10px] text-[#8B98A9] uppercase tracking-wider">{k.label}</p>
            <p className="text-xl font-bold tabular mt-1 text-green-400">{k.value}</p>
            <p className="text-[10px] text-green-400">{k.delta} vs last month</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
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
              <Button size="sm" variant="success" className="flex-1"><CheckCircle className="w-3 h-3" />Approve</Button>
              <Button size="sm" variant="secondary" className="flex-1">Simulate</Button>
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
