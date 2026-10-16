"use client";
import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, FileText, CheckCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  fetchDemandForecast,
  fetchDemandAdjustments,
  updateDemandAdjustment,
  overrideForecast,
  fetchSopPreread,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

function buildSkuForecastSeries(sku: string, acceptedBoostPct: number) {
  const baseLevel = sku === "TM-300" ? 4200 : sku === "HSG-220" ? 2900 : 1850;
  const slope = sku === "TM-300" ? 12 : sku === "HSG-220" ? 6 : 4;
  const multiplier = 1 + acceptedBoostPct / 100;

  return Array.from({ length: 30 }, (_, i) => {
    const raw = (baseLevel + Math.sin(i * 0.22) * (baseLevel * 0.08) + i * slope) * (i >= 7 ? multiplier : 1);
    return {
      day: `D+${i}`,
      forecast: Math.round(raw),
      lower: Math.round(raw * 0.89),
      upper: Math.round(raw * 1.11),
      actual: i <= 7 ? Math.round(baseLevel + Math.sin(i * 0.5) * (baseLevel * 0.04) + i * slope) : null,
    };
  });
}

const INITIAL_ADJUSTMENTS = [
  { id: "adj-1", sku: "TM-300", customer: "Tata & Zenith Motors", adj: "+8%", deltaPct: 8, reason: "EV commercial fleet subsidy extended (India PLI)", expires: "Nov–Dec", status: "pending", plant_id: "PNQ" },
  { id: "adj-2", sku: "GBX-100", customer: "Kirin Mobility", adj: "+5%", deltaPct: 5, reason: "New e-Axle model launch Q4 pull-ahead", expires: "Dec", status: "accepted", plant_id: "NGO" },
  { id: "adj-3", sku: "HSG-220", customer: "Siam & Arka EV", adj: "-3%", deltaPct: -3, reason: "Tier-1 chassis trim revision smoothing", expires: "Nov", status: "pending", plant_id: "RYG" },
];

const SOP_ROWS = [
  { sku: "TM-300", plant: "PNQ", name: "Traction Inverter Module", demand: "18,400", supply: "16,200", gap: "−2,200", action: "Weekend shift + Renesas Penang split" },
  { sku: "HSG-220", plant: "RYG", name: "Die-Cast Inverter Housing", demand: "9,800", supply: "10,200", gap: "+400", action: "Build safety stock buffer" },
  { sku: "GBX-100", plant: "NGO", name: "Precision e-Axle Gearbox", demand: "6,100", supply: "6,100", gap: "0", action: "Balanced — Off-peak furnace schedule" },
];

export default function Demand() {
  const { selectedPlant } = useAppStore();
  const [selectedSku, setSelectedSku] = useState<string>("TM-300");
  const [adjustments, setAdjustments] = useState(INITIAL_ADJUSTMENTS);
  const [preReadGenerated, setPreReadGenerated] = useState(false);
  const [preReadLoading, setPreReadLoading] = useState(false);
  const [preReadDocId, setPreReadDocId] = useState<string>("SOP-2026-11-PREREAD");
  const [syncedSkus, setSyncedSkus] = useState<Record<string, boolean>>({});

  // Automatically switch active SKU when top plant selector changes
  useEffect(() => {
    const defaultSkuForPlant =
      selectedPlant === "RYG" ? "HSG-220" : selectedPlant === "NGO" ? "GBX-100" : "TM-300";
    setSelectedSku(defaultSkuForPlant);

    const plantParam = selectedPlant === "ALL" ? undefined : selectedPlant;
    Promise.all([
      fetchDemandForecast(defaultSkuForPlant, plantParam),
      fetchDemandAdjustments(plantParam),
    ]).catch(() => {});
  }, [selectedPlant]);

  const filteredAdjustments = useMemo(() => {
    return selectedPlant === "ALL"
      ? adjustments
      : adjustments.filter((a) => a.plant_id === selectedPlant);
  }, [adjustments, selectedPlant]);

  const filteredSopRows = useMemo(() => {
    return selectedPlant === "ALL"
      ? SOP_ROWS
      : SOP_ROWS.filter((r) => r.plant === selectedPlant);
  }, [selectedPlant]);

  const acceptedBoostForSelectedSku = useMemo(() => {
    return adjustments
      .filter((a) => a.sku === selectedSku && a.status === "accepted")
      .reduce((acc, a) => acc + (a.deltaPct || 0), 0);
  }, [adjustments, selectedSku]);

  const chartData = useMemo(() => {
    return buildSkuForecastSeries(selectedSku, acceptedBoostForSelectedSku);
  }, [selectedSku, acceptedBoostForSelectedSku]);

  const handleUpdateStatus = async (id: string, newStatus: "accepted" | "rejected") => {
    const target = adjustments.find((a) => a.id === id);
    if (target) {
      setSelectedSku(target.sku);
    }
    setAdjustments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
    try {
      await Promise.all([
        updateDemandAdjustment(id, newStatus),
        target
          ? overrideForecast({
              sku: target.sku,
              customer: target.customer,
              adjustment: target.adj,
              action: newStatus === "accepted" ? "accept" : "reject",
              reason: target.reason,
            })
          : Promise.resolve(),
      ]);
    } catch {
      // Handled optimistically
    }
  };

  const handleGeneratePreRead = async () => {
    if (preReadGenerated) {
      setPreReadGenerated(false);
      return;
    }
    setPreReadLoading(true);
    try {
      const res = await fetchSopPreread("Nov 2026");
      if (res?.document_id) {
        setPreReadDocId(res.document_id);
      }
      setPreReadGenerated(true);
    } catch {
      setPreReadGenerated(true);
    } finally {
      setPreReadLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <TrendingUp className="w-5 h-5 text-[#8B5CF6]" />
        <h1 className="text-lg font-bold text-[#E6EDF3]">Demand Sensing & S&OP</h1>
        <Badge variant="default">Oracle Agent · TimesFM 2.5</Badge>
        {selectedPlant !== "ALL" && (
          <Badge variant="scenario" className="font-mono text-[10px]">Site: {selectedPlant}</Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] text-[#8B98A9] mr-1">Active SKU:</span>
          {["TM-300", "HSG-220", "GBX-100"].map((sku) => (
            <button
              key={sku}
              type="button"
              onClick={() => setSelectedSku(sku)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-mono font-semibold border transition-all cursor-pointer",
                selectedSku === sku
                  ? "bg-[#8B5CF6]/20 text-[#C4B5FD] border-[#8B5CF6]"
                  : "bg-[#0B0F14] text-[#8B98A9] border-[#243042] hover:text-[#E6EDF3]"
              )}
            >
              {sku}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Forecast chart */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{selectedSku} Demand Forecast — 30-Day Horizon</CardTitle>
              {acceptedBoostForSelectedSku !== 0 && (
                <Badge variant="ok" className="text-[10px] font-mono">
                  {acceptedBoostForSelectedSku > 0 ? `+${acceptedBoostForSelectedSku}%` : `${acceptedBoostForSelectedSku}%`} Signal Applied
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-[#8B98A9]">BigQuery AI.FORECAST · 90% CI</span>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: "#8B98A9", fontSize: 10 }} interval={4} />
                <YAxis tick={{ fill: "#8B98A9", fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "#121821", border: "1px solid #243042", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#8B98A9" }}
                />
                <Area type="monotone" dataKey="upper" stroke="none" fill="url(#ciGrad)" name="Upper 90% CI" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#0B0F14" name="Lower 90% CI" />
                <Area type="monotone" dataKey="forecast" stroke="#8B5CF6" strokeWidth={2.2} fill="none" name="TimesFM Forecast" dot={false} />
                <Area type="monotone" dataKey="actual" stroke="#22C55E" strokeWidth={2.2} fill="none" name="Actual Shipments" dot={false} />
                <ReferenceLine x="D+7" stroke="#38BDF8" strokeDasharray="4 2" label={{ value: "Today", fill: "#38BDF8", fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-[10px]">
            {[
              { color: "#8B5CF6", label: "TimesFM Forecast" },
              { color: "#22C55E", label: "Actual Shipments" },
              { color: "#8B5CF6", label: "90% Confidence Band", opacity: 0.35 },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1 text-[#8B98A9]">
                <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: l.color, opacity: l.opacity || 1 }} />
                {l.label}
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
            {filteredAdjustments.map((adj) => (
              <div
                key={adj.id}
                onClick={() => setSelectedSku(adj.sku)}
                className={cn(
                  "p-2.5 rounded-lg bg-[#0B0F14] border text-xs space-y-1.5 cursor-pointer transition-colors",
                  selectedSku === adj.sku ? "border-[#8B5CF6]/60" : "border-[#243042]"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#E6EDF3] font-mono">{adj.sku}</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-[#1A2230] text-[#8B98A9]">{adj.plant_id}</span>
                  <span className="text-[#8B98A9] truncate">→ {adj.customer}</span>
                  <span className={adj.adj.startsWith("+") ? "text-green-400 font-bold ml-auto" : "text-amber-400 font-bold ml-auto"}>
                    {adj.adj}
                  </span>
                </div>
                <p className="text-[#8B98A9] text-[11px]">{adj.reason}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#8B98A9]">Window: {adj.expires}</span>
                  {adj.status === "pending" ? (
                    <div className="flex gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="success"
                        className="text-[10px] px-2 py-0.5 h-6"
                        onClick={() => handleUpdateStatus(adj.id, "accepted")}
                      >
                        Accept Signal
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="text-[10px] px-2 py-0.5 h-6"
                        onClick={() => handleUpdateStatus(adj.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
                      <Badge variant={adj.status === "accepted" ? "ok" : "critical"} className="capitalize">
                        {adj.status}
                      </Badge>
                      <button
                        type="button"
                        onClick={() =>
                          setAdjustments((prev) =>
                            prev.map((x) => (x.id === adj.id ? { ...x, status: "pending" } : x))
                          )
                        }
                        className="text-[10px] text-[#8B98A9] hover:text-white underline cursor-pointer"
                      >
                        Undo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* S&OP gap */}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle>S&OP Consensus Plan & Gap Analysis — Nov 2026</CardTitle>
            <Button
              size="sm"
              disabled={preReadLoading}
              variant={preReadGenerated ? "success" : "secondary"}
              onClick={handleGeneratePreRead}
            >
              {preReadLoading ? (
                "Generating..."
              ) : preReadGenerated ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Executive Pre-Read Ready ({preReadDocId})
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 mr-1" /> Generate S&OP Pre-Read
                </>
              )}
            </Button>
          </CardHeader>

          {preReadGenerated && (
            <div className="mb-3 p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-primary">
                S&OP Executive Brief · <span className="font-mono">{preReadDocId}</span> (Gemini 2.5 Pro Synthesis):
              </p>
              <p className="text-base-content/80 leading-relaxed">
                Primary constraint is <strong>TM-300</strong> capacity at Pune (−2,200 units deficit against Tata & Kirin commitments).
                Recommending dual-track activation: Saturday 2-shift overtime on <code>PNQ-CNC-08/11</code> combined with split-sourcing 500 Gate-Driver ICs from Renesas Penang to preserve 98.2% OTIF.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#243042]">
                  {["SKU", "Plant", "Product Family", "Demand Plan", "Supply Plan", "Net Gap", "Recommended Action", "MRP Sync"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-[#8B98A9] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSopRows.map((row) => {
                  const isSynced = syncedSkus[row.sku];
                  return (
                    <tr
                      key={row.sku}
                      onClick={() => setSelectedSku(row.sku)}
                      className={cn(
                        "border-b border-[#243042]/50 hover:bg-[#121821] cursor-pointer",
                        selectedSku === row.sku && "bg-[#1A2230]/60"
                      )}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-[#E6EDF3]">{row.sku}</td>
                      <td className="py-2 px-3 font-mono text-[#8B98A9]">{row.plant}</td>
                      <td className="py-2 px-3 text-[#E6EDF3]">{row.name}</td>
                      <td className="py-2 px-3 text-[#E6EDF3] font-mono">{row.demand}</td>
                      <td className="py-2 px-3 text-[#E6EDF3] font-mono">{row.supply}</td>
                      <td
                        className={`py-2 px-3 font-bold font-mono tabular ${
                          row.gap.startsWith("−") ? "text-red-400" : row.gap === "0" ? "text-green-400" : "text-blue-400"
                        }`}
                      >
                        {row.gap}
                      </td>
                      <td className="py-2 px-3 text-[#8B98A9]">{row.action}</td>
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        {isSynced ? (
                          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Synced to MRP
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            className="h-6 text-[10px] px-2.5"
                            onClick={() => setSyncedSkus((prev) => ({ ...prev, [row.sku]: true }))}
                          >
                            Sync to MRP
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
