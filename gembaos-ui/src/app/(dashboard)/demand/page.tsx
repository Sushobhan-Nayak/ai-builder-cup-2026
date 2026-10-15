"use client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FORECAST_DATA } from "@/lib/mock-data";
import { TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const chartData = FORECAST_DATA.slice(0, 30).map((d, i) => ({
  day: `D+${i}`,
  forecast: d.forecast,
  lower: d.lower,
  upper: d.upper,
  actual: d.actual,
}));

export default function Demand() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-5 h-5 text-[#8B5CF6]" />
        <h1 className="text-lg font-bold text-[#E6EDF3]">Demand Sensing & S&OP</h1>
        <Badge variant="default">Oracle Agent · TimesFM 2.5</Badge>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Forecast chart */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <CardTitle>TM-300 Demand Forecast — 30-day horizon</CardTitle>
            <span className="text-[10px] text-[#8B98A9]">BigQuery AI.FORECAST · 90% CI</span>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: "#8B98A9", fontSize: 10 }} interval={4} />
                <YAxis tick={{ fill: "#8B98A9", fontSize: 10 }} domain={[3000, 6000]} />
                <Tooltip
                  contentStyle={{ background: "#121821", border: "1px solid #243042", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#8B98A9" }}
                />
                <Area type="monotone" dataKey="upper" stroke="none" fill="url(#ciGrad)" name="Upper CI" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#0B0F14" name="Lower CI" />
                <Area type="monotone" dataKey="forecast" stroke="#8B5CF6" strokeWidth={2} fill="none" name="Forecast" dot={false} />
                <Area type="monotone" dataKey="actual" stroke="#22C55E" strokeWidth={2} fill="none" name="Actual" dot={false} />
                <ReferenceLine x="D+7" stroke="#243042" strokeDasharray="4 2" label={{ value: "Today", fill: "#8B98A9", fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-[10px]">
            {[{ color: "#8B5CF6", label: "Forecast" }, { color: "#22C55E", label: "Actual" }, { color: "#8B5CF6", label: "90% CI", opacity: 0.3 }].map((l) => (
              <span key={l.label} className="flex items-center gap-1 text-[#8B98A9]">
                <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: l.color, opacity: l.opacity || 1 }} />{l.label}
              </span>
            ))}
          </div>
        </Card>

        {/* Signal adjustments */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <CardTitle>Demand Sensing Adjustments</CardTitle>
            <Badge variant="default">Oracle</Badge>
          </CardHeader>
          <div className="space-y-2">
            {[
              { sku: "TM-300", customer: "Zenith Motors", adj: "+8%", reason: "EV subsidy extended (India PLI)", expires: "Nov–Dec", status: "pending" },
              { sku: "GBX-100", customer: "Kirin Mobility", adj: "+5%", reason: "New model launch Q4", expires: "Dec", status: "accepted" },
              { sku: "HSG-220", customer: "Arka EV", adj: "−3%", reason: "Competitor recall — demand shift", expires: "Oct", status: "pending" },
            ].map((adj, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-[#0B0F14] border border-[#243042] text-xs space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#E6EDF3]">{adj.sku}</span>
                  <span className="text-[#8B98A9]">→ {adj.customer}</span>
                  <span className={adj.adj.startsWith("+") ? "text-green-400 font-bold ml-auto" : "text-red-400 font-bold ml-auto"}>{adj.adj}</span>
                </div>
                <p className="text-[#8B98A9]">{adj.reason}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#8B98A9]">Expires: {adj.expires}</span>
                  {adj.status === "pending" ? (
                    <div className="flex gap-1 ml-auto">
                      <Button size="sm" variant="success" className="text-[10px] px-2 py-0.5">Accept</Button>
                      <Button size="sm" variant="danger" className="text-[10px] px-2 py-0.5">Reject</Button>
                    </div>
                  ) : (
                    <Badge variant="ok" className="ml-auto">Accepted</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* S&OP gap */}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle>S&OP Gap Analysis — Nov 2026</CardTitle>
            <Button size="sm" variant="secondary">Generate Pre-read</Button>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#243042]">
                  {["SKU", "Demand Plan", "Supply Plan", "Gap", "Action"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-[#8B98A9] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { sku: "TM-300", demand: "18,400", supply: "16,200", gap: "−2,200", action: "Overtime + alt sourcing" },
                  { sku: "HSG-220", demand: "9,800", supply: "10,200", gap: "+400", action: "Build to stock" },
                  { sku: "GBX-100", demand: "6,100", supply: "6,100", gap: "0", action: "On plan" },
                ].map((row) => (
                  <tr key={row.sku} className="border-b border-[#243042]/50 hover:bg-[#121821]">
                    <td className="py-2 px-3 font-medium text-[#E6EDF3]">{row.sku}</td>
                    <td className="py-2 px-3 text-[#E6EDF3]">{row.demand}</td>
                    <td className="py-2 px-3 text-[#E6EDF3]">{row.supply}</td>
                    <td className={`py-2 px-3 font-bold tabular ${row.gap.startsWith("−") ? "text-red-400" : row.gap === "0" ? "text-green-400" : "text-blue-400"}`}>{row.gap}</td>
                    <td className="py-2 px-3 text-[#8B98A9]">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
