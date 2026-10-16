"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Shield, CheckCircle, Wrench, AlertTriangle, PackageCheck, CalendarClock } from "lucide-react";
import {
  fetchAsset,
  fetchAssetTelemetry,
  fetchAssetHealth,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

export const ASSETS = [
  { id: "PNQ-CNC-07", name: "CNC Mill 07", plant: "PNQ", line: "L1", type: "CNC", health: 42, state: "warning", rul: 68, rulP10: 26.5, rulP90: 48 },
  { id: "PNQ-CNC-03", name: "CNC Mill 03", plant: "PNQ", line: "L1", type: "CNC", health: 87, state: "running", rul: 320, rulP10: 280, rulP90: 380 },
  { id: "PNQ-ROB-01", name: "Robotic Welder 01", plant: "PNQ", line: "L2", type: "Robot", health: 91, state: "running", rul: 450, rulP10: 400, rulP90: 510 },
  { id: "RYG-DCM-02", name: "Die Cast Machine 02", plant: "RYG", line: "L1", type: "DieCast", health: 63, state: "warning", rul: 120, rulP10: 90, rulP90: 160 },
  { id: "RYG-DCM-04", name: "Die Cast Machine 04", plant: "RYG", line: "L1", type: "DieCast", health: 79, state: "running", rul: 280, rulP10: 240, rulP90: 330 },
  { id: "NGO-FUR-02", name: "Heat Treat Furnace 02", plant: "NGO", line: "L3", type: "Furnace", health: 95, state: "running", rul: 600, rulP10: 550, rulP90: 680 },
  { id: "NGO-GRD-01", name: "Gear Grinder 01", plant: "NGO", line: "L2", type: "Grinder", health: 88, state: "running", rul: 390, rulP10: 350, rulP90: 440 },
  { id: "PNQ-CMP-01", name: "Air Compressor 01", plant: "PNQ", line: "UTIL", type: "Compressor", health: 72, state: "idle", rul: 200, rulP10: 160, rulP90: 250 },
];

function HealthRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const color = score > 80 ? "#22C55E" : score > 60 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#243042" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize="11" fontWeight="bold">
        {score}
      </text>
    </svg>
  );
}

function RulFan({ p10, p50, p90 }: { p10: number; p50: number; p90: number }) {
  const max = Math.max(p90 + 20, 50);
  return (
    <div className="flex items-end gap-1 h-12">
      {[
        { label: "P10", val: p10, color: "#EF4444" },
        { label: "P50", val: p50, color: "#F59E0B" },
        { label: "P90", val: p90, color: "#22C55E" },
      ].map(({ label, val, color }) => (
        <div key={label} className="flex flex-col items-center gap-0.5 flex-1">
          <span className="text-[9px] tabular font-semibold" style={{ color }}>{val}h</span>
          <div
            className="w-full rounded-t"
            style={{ height: `${Math.max(6, (val / max) * 40)}px`, backgroundColor: color, opacity: 0.8 }}
          />
          <span className="text-[9px] text-[#8B98A9]">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function AssetHealthView({ assetId }: { assetId?: string }) {
  const initialAsset = (assetId && ASSETS.find(a => a.id === assetId)) || ASSETS[0];
  const [selected, setSelected] = useState(initialAsset);
  const [assetDetail, setAssetDetail] = useState<any>(initialAsset);
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [workOrderCreated, setWorkOrderCreated] = useState(false);
  const [loading, setLoading] = useState(false);
  const { selectedPlant } = useAppStore();

  const filteredAssets = selectedPlant === "ALL"
    ? ASSETS
    : ASSETS.filter(a => a.plant === selectedPlant);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    // Call /v1/assets/{id}, /v1/assets/{id}/telemetry, /v1/assets/{id}/health
    Promise.all([
      fetchAsset(selected.id),
      fetchAssetTelemetry(selected.id, { minutes: 60, metric: "vib_rms" }),
      fetchAssetHealth(selected.id),
    ]).then(([assetRes, telemetryRes, healthRes]) => {
      if (mounted) {
        if (assetRes) setAssetDetail(assetRes);
        const rawTelemetry = Array.isArray(telemetryRes)
          ? telemetryRes
          : Array.isArray((telemetryRes as any)?.readings)
          ? (telemetryRes as any).readings
          : [];
        if (rawTelemetry.length > 0) {
          setTelemetry(
            rawTelemetry.map((d: any, idx: number) => ({
              i: idx,
              time: d.ts_min ? d.ts_min.split("T")[1]?.slice(0, 5) : `${idx}m`,
              vib: +(d.avg_value ?? d.vib_rms ?? d.vib ?? 1.0).toFixed(3),
              temp: +(d.temp_c ?? d.temp ?? 45).toFixed(1),
              threshold: 2.5,
            }))
          );
        }
        if (healthRes) setHealthData(healthRes);
        setLoading(false);
      }
    }).catch((err) => {
      console.warn("Asset data fetch error:", err);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [selected.id]);

  const p10 = healthData?.rul_hours?.p10 ?? selected.rulP10 ?? 26.5;
  const p50 = healthData?.rul_hours?.p50 ?? selected.rul ?? 34.0;
  const p90 = healthData?.rul_hours?.p90 ?? selected.rulP90 ?? 48.0;
  const healthScore = healthData?.health_score ?? selected.health;
  const failureMode = healthData?.failure_mode || "Outer-race bearing spalling";
  const requiredPart = healthData?.required_part || "BRG-6205";
  const onHandStatus = healthData?.on_hand_status || "Available (18 units in Pune Crib B)";
  const maintWindow = healthData?.recommended_maintenance_window || "Thursday 14:00 (PM shift)";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-[#4F8CFF]" />
        <h1 className="text-lg font-bold text-[#E6EDF3]">Asset Health</h1>
        <Badge variant="default">Sentinel Agent</Badge>
        <span className="text-xs text-[#8B98A9] ml-auto font-mono">
          {filteredAssets.length} assets · {selectedPlant === "ALL" ? "All Plants" : selectedPlant}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Asset list */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <CardTitle>Assets by Health</CardTitle>
            <span className="text-[10px] text-[#8B98A9]">sorted by criticality</span>
          </CardHeader>
          <div className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-220px)]">
            {[...filteredAssets].sort((a, b) => a.health - b.health).map((asset) => (
              <button
                key={asset.id}
                onClick={() => {
                  setSelected(asset);
                  setWorkOrderCreated(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left",
                  selected.id === asset.id
                    ? "bg-[#1A2230] border-[#4F8CFF]/50 shadow-sm"
                    : "bg-[#0B0F14] border-[#243042] hover:border-[#243042]/80"
                )}
              >
                <HealthRing score={asset.health} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#E6EDF3] truncate">{asset.name}</p>
                  <p className="text-[10px] text-[#8B98A9]">{asset.plant} · {asset.type} · Line {asset.line}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-[#8B98A9]">RUL</p>
                  <p className={cn("text-xs font-bold tabular", asset.rul < 100 ? "text-red-400" : "text-[#E6EDF3]")}>
                    {asset.rul}h
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Asset detail */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Header - Connected to /v1/assets/{id} & /v1/assets/{id}/health */}
          <Card glow={healthScore < 60}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#E6EDF3]">
                    {assetDetail?.name || selected.name}
                  </h2>
                  <Badge variant={healthScore < 50 ? "critical" : healthScore < 70 ? "high" : "ok"}>
                    {healthScore < 50 ? "Critical" : healthScore < 70 ? "Degrading" : "Healthy"}
                  </Badge>
                  <Badge variant="default">{assetDetail?.plant || selected.plant}</Badge>
                  <span className="text-[10px] font-mono text-[#8B98A9] border border-base-content/10 px-1.5 py-0.5 rounded">
                    Line {assetDetail?.line || selected.line}
                  </span>
                </div>
                <p className="text-xs text-[#8B98A9] mt-0.5">
                  ID: <span className="font-mono text-white/90">{selected.id}</span> · Criticality: <span className="text-red-400 font-medium">CRITICAL</span>
                </p>
                <div className="flex items-center gap-6 mt-3">
                  <div>
                    <p className="text-[10px] text-[#8B98A9] uppercase tracking-wider">RUL (P50)</p>
                    <p className={cn("text-xl font-bold tabular", p50 < 100 ? "text-red-400" : "text-[#E6EDF3]")}>
                      {p50}h
                    </p>
                  </div>
                  <RulFan p10={p10} p50={p50} p90={p90} />
                </div>
              </div>

              {!workOrderCreated ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setWorkOrderCreated(true)}
                  className="shrink-0"
                >
                  <Wrench className="w-3.5 h-3.5" /> Plan Maintenance
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" /> WO Created · {maintWindow}
                </div>
              )}
            </div>
          </Card>

          {/* Sensor chart - Connected to /v1/assets/{id}/telemetry */}
          <Card>
            <CardHeader>
              <CardTitle>Vibration Telemetry — RMS Curve</CardTitle>
              <span className="text-[10px] text-[#8B98A9]">
                Endpoint: /v1/assets/{selected.id}/telemetry · Last 60 min
              </span>
            </CardHeader>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetry} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <XAxis dataKey="i" hide />
                  <YAxis domain={[0, 3.5]} tick={{ fill: "#8B98A9", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#121821", border: "1px solid #243042", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#8B98A9" }}
                    itemStyle={{ color: "#E6EDF3" }}
                  />
                  <ReferenceLine
                    y={2.5}
                    stroke="#EF4444"
                    strokeDasharray="4 2"
                    label={{ value: "Threshold (2.5 mm/s)", fill: "#EF4444", fontSize: 10, position: "top" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="vib"
                    stroke="#4F8CFF"
                    strokeWidth={1.8}
                    dot={false}
                    name="RMS Vibration (mm/s)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Diagnosis & Prescriptions from Sentinel - Connected to /v1/assets/{id}/health */}
          <div className="grid grid-cols-2 gap-4">
            <Card glow={healthScore < 60}>
              <CardHeader>
                <CardTitle className="text-xs">Sentinel Diagnostic Insight</CardTitle>
                <Badge variant="high">AI Root Cause</Badge>
              </CardHeader>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                  <span className="font-semibold text-[#E6EDF3]">{failureMode}</span>
                </div>
                <p className="text-[11px] text-[#8B98A9]">
                  Vibration RMS breach at 2.82 mm/s with 82% confidence of outer-race fatigue. Correlated to 12% rise in motor winding temperature.
                </p>
                <div className="flex gap-2 text-[10px] text-primary font-mono pt-1">
                  <span>[ev:sql-101]</span>
                  <span>[ev:opt-1]</span>
                  <span>[ev:vib-fft-2]</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Prescriptive Safeguards</CardTitle>
                <Badge variant="ok">Available</Badge>
              </CardHeader>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-[#E6EDF3]">
                    Required Spares: <strong>{requiredPart}</strong>
                  </span>
                </div>
                <p className="text-[11px] text-green-400 font-medium">
                  Status: {onHandStatus}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <CalendarClock className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-[11px] text-[#8B98A9]">
                    Optimal Slot: <strong className="text-[#E6EDF3]">{maintWindow}</strong>
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
