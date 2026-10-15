"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ASSETS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Shield, CheckCircle, Wrench, AlertTriangle, PackageCheck, CalendarClock } from "lucide-react";
import {
  fetchAsset,
  fetchAssetTelemetry,
  fetchAssetHealth,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

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

export default function AssetHealth({ paramsAssetId }: { paramsAssetId?: string }) {
  const initialAsset = (paramsAssetId && ASSETS.find(a => a.id === paramsAssetId)) || ASSETS[0];
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
          <Card>
            <div className="flex items-start gap-4">
              <HealthRing score={healthScore} size={56} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-[#E6EDF3]">
                    {assetDetail?.name || selected.name}
                  </h2>
                  <Badge variant={healthScore < 50 ? "critical" : healthScore < 70 ? "medium" : "ok"}>
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

          {/* Sentinel RUL & Spares Check - Connected to /v1/assets/{id}/health */}
          <Card glow>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-[#A78BFA]">🛡 Sentinel RUL & Reliability Diagnosis</span>
              </CardTitle>
              <Badge variant="critical">Fault Confidence: 91%</Badge>
            </CardHeader>
            <div className="space-y-3">
              <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#243042]">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#E6EDF3]">
                    Failure Mode: {failureMode}
                  </p>
                  <span className="text-[10px] text-warning font-mono">P10 RUL: {p10}h</span>
                </div>
                <p className="text-[11px] text-[#8B98A9] mt-1.5 leading-relaxed">
                  Spectral kurtosis elevated (8.4 vs nominal 3.1). Outer-race bearing spalling detected on {selected.name}.
                  Rapid degradation expected within the next {p10} hours if load is unmitigated.
                </p>
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {["ev:fft-87hz", "ev:kurtosis-8.4", "ev:iso-10816-3", "ev:manual-crib-b"].map((ev) => (
                    <span
                      key={ev}
                      className="text-[10px] bg-[#1A2230] border border-[#243042] text-[#A78BFA] px-1.5 py-0.5 rounded cursor-pointer hover:border-[#A78BFA]"
                    >
                      [{ev}]
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Spares and Stock Check */}
                <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#243042] space-y-1">
                  <div className="flex items-center gap-1.5 text-[#8B98A9]">
                    <PackageCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Spares & Stock Check</span>
                  </div>
                  <p className="text-[#E6EDF3] font-semibold">{requiredPart}</p>
                  <p className="text-green-400 text-[11px] font-medium">{onHandStatus}</p>
                </div>

                {/* Recommended Maintenance Window */}
                <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#243042] space-y-1">
                  <div className="flex items-center gap-1.5 text-[#8B98A9]">
                    <CalendarClock className="w-3.5 h-3.5 text-warning" />
                    <span>Recommended Window</span>
                  </div>
                  <p className="text-[#E6EDF3] font-semibold">{maintWindow}</p>
                  <p className="text-[#8B98A9] text-[11px]">Before P10 ({p10}h) failure boundary</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
