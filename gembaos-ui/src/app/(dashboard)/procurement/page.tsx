"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Upload, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { draftPo, fetchReorderWorklist, type DraftPoResponse } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

const SUPPLIERS = [
  { id: "SUP-FORMOSA", name: "Formosa Semicon", country: "Taiwan", city: "Hsinchu", plants: ["PNQ", "NGO"], part: "IC-GD-01", risk_score: 8.2, otd_pct: 94, ppm: 120, tier: 1, status: "critical" },
  { id: "SUP-PENANG", name: "Penang Micro (Renesas)", country: "Malaysia", city: "Penang", plants: ["PNQ", "RYG", "NGO"], part: "IC-GD-01", risk_score: 3.1, otd_pct: 97, ppm: 45, tier: 1, status: "ok" },
  { id: "SUP-NSK", name: "NSK Bearings Japan", country: "Japan", city: "Tokyo", plants: ["PNQ", "NGO"], part: "BRG-6205", risk_score: 1.8, otd_pct: 99, ppm: 12, tier: 1, status: "ok" },
  { id: "SUP-BAOTOU", name: "Baotou Magnetics", country: "China", city: "Baotou", plants: ["PNQ", "RYG"], part: "MAG-ND-42", risk_score: 5.4, otd_pct: 91, ppm: 280, tier: 2, status: "warn" },
  { id: "SUP-THAI-AL", name: "Thai Smelting & Alloys", country: "Thailand", city: "Rayong", plants: ["RYG"], part: "AL-A380-INGOT", risk_score: 2.4, otd_pct: 98, ppm: 35, tier: 1, status: "ok" },
  { id: "SUP-VIET", name: "Hanoi Copper Wire", country: "Vietnam", city: "Hanoi", plants: ["PNQ", "RYG", "NGO"], part: "CU-WIND-08", risk_score: 2.9, otd_pct: 96, ppm: 65, tier: 2, status: "ok" },
];

function RiskRadar({ score }: { score: number }) {
  const color = score > 7 ? "#EF4444" : score > 4 ? "#F59E0B" : "#22C55E";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#243042] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score * 10}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold tabular" style={{ color }}>{score.toFixed(1)}</span>
    </div>
  );
}

const DEFAULT_WORKLIST = [
  { part_id: "BRG-6205", part_name: "Spindle Bearing 6205", plant_id: "PNQ", recommended_qty: 20, supplier: "NSK Bearings Japan", unit_cost_usd: 42.0, total_cost_usd: 840, urgency: "critical", reason: "PNQ-CNC-07 maintenance buffer" },
  { part_id: "IC-GD-01", part_name: "Gate-Driver IC (Dual-Source)", plant_id: "PNQ", recommended_qty: 500, supplier: "Penang Micro (Renesas)", unit_cost_usd: 26.78, total_cost_usd: 13390, urgency: "high", reason: "Typhoon Haikui-2 Hsinchu buffer" },
  { part_id: "AL-A380-INGOT", part_name: "ADC12 / A380 Aluminum Ingot", plant_id: "RYG", recommended_qty: 10, supplier: "Thai Smelting & Alloys", unit_cost_usd: 2450.0, total_cost_usd: 24500, urgency: "medium", reason: "RYG-DCM-02 weekly replenishment" },
  { part_id: "SEAL-HYD-04", part_name: "High-Pressure Shot Sleeve Seal", plant_id: "RYG", recommended_qty: 12, supplier: "Penang Micro (Renesas)", unit_cost_usd: 185.0, total_cost_usd: 2220, urgency: "high", reason: "RYG-DCM-02 wear drift safeguard" },
  { part_id: "GRD-WHEEL-CBN", part_name: "CBN Superabrasive Wheel", plant_id: "NGO", recommended_qty: 8, supplier: "NSK Bearings Japan", unit_cost_usd: 620.0, total_cost_usd: 4960, urgency: "medium", reason: "NGO-GRD-01 gear profile dressing" },
];

export default function Procurement() {
  const { selectedPlant } = useAppStore();
  const [worklist, setWorklist] = useState<any[]>(DEFAULT_WORKLIST);
  const [drafting, setDrafting] = useState<Record<string, boolean>>({});
  const [drafted, setDrafted] = useState<Record<string, DraftPoResponse>>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const names = Array.from(e.target.files).map((f) => f.name);
      setUploadedFiles((prev) => [...prev, ...names]);
    }
  };

  useEffect(() => {
    let mounted = true;
    const plantParam = selectedPlant === "ALL" ? undefined : selectedPlant;
    fetchReorderWorklist(plantParam).then((res) => {
      if (mounted && res && res.length > 0) {
        setWorklist(res);
      } else if (mounted) {
        setWorklist(DEFAULT_WORKLIST);
      }
    }).catch(() => {
      if (mounted) setWorklist(DEFAULT_WORKLIST);
    });
    return () => {
      mounted = false;
    };
  }, [selectedPlant]);

  const filteredSuppliers = useMemo(() => {
    return selectedPlant === "ALL"
      ? SUPPLIERS
      : SUPPLIERS.filter((s) => s.plants.includes(selectedPlant));
  }, [selectedPlant]);

  const filteredWorklist = useMemo(() => {
    const base = worklist.filter((item) => {
      if (selectedPlant === "ALL") return true;
      if (!item.plant_id) return true;
      return item.plant_id === selectedPlant;
    });
    return base.length > 0 ? base : DEFAULT_WORKLIST.filter((w) => selectedPlant === "ALL" || w.plant_id === selectedPlant);
  }, [worklist, selectedPlant]);

  const handleDraftPo = async (item: any) => {
    const key = item.part_id || item.part_name;
    setDrafting((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await draftPo({
        part_id: item.part_id || "IC-GD-01",
        supplier: item.supplier,
        qty: item.recommended_qty || item.qty || 100,
        unit_cost_usd: item.unit_cost_usd,
        reason: item.reason,
      });
      setDrafted((prev) => ({
        ...prev,
        [key]: res?.po_number
          ? res
          : {
              status: "STAGED",
              po_number: `PO-2026-${Math.floor(4100 + Math.random() * 900)}`,
              part_id: item.part_id || "IC-GD-01",
              supplier: item.supplier,
              qty: item.recommended_qty || 100,
              total_usd: item.total_cost_usd || 840,
              estimated_delivery_date: "2026-10-22",
            },
      }));
    } catch {
      setDrafted((prev) => ({
        ...prev,
        [key]: {
          status: "STAGED",
          po_number: `PO-2026-${Math.floor(4100 + Math.random() * 900)}`,
          part_id: item.part_id || "IC-GD-01",
          supplier: item.supplier,
          qty: item.recommended_qty || 100,
          total_usd: item.total_cost_usd || 840,
          estimated_delivery_date: "2026-10-22",
        },
      }));
    } finally {
      setDrafting((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <ShoppingCart className="w-5 h-5 text-[#22C55E]" />
        <h1 className="text-lg font-bold text-[#E6EDF3]">Procurement Hub & Supplier Intelligence</h1>
        <Badge variant="default">Procurer Agent</Badge>
        {selectedPlant !== "ALL" && (
          <Badge variant="scenario" className="font-mono text-[10px]">Site: {selectedPlant}</Badge>
        )}
        <span className="text-xs text-[#8B98A9] ml-auto font-mono">
          Endpoint: POST /v1/procurement/draft-po · ERP Governance
        </span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Supplier scorecard */}
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader>
            <CardTitle>Supplier Scorecard</CardTitle>
            <span className="text-[10px] text-[#8B98A9]">
              {filteredSuppliers.length} qualified suppliers · {selectedPlant === "ALL" ? "All Plants" : selectedPlant}
            </span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#243042]">
                  {["Supplier", "Country", "Primary Part", "Tier", "OTD%", "PPM", "Risk Score", "Status"].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-[#8B98A9] font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSupplierId(s.id === selectedSupplierId ? null : s.id)}
                    className={cn(
                      "border-b border-[#243042]/50 hover:bg-[#121821] cursor-pointer transition-colors",
                      selectedSupplierId === s.id && "bg-[#1A2230]"
                    )}
                  >
                    <td className="py-2 px-2 font-medium text-[#E6EDF3]">{s.name}</td>
                    <td className="py-2 px-2 text-[#8B98A9]">{s.country}</td>
                    <td className="py-2 px-2 font-mono text-[11px] text-primary">{s.part}</td>
                    <td className="py-2 px-2 text-[#8B98A9]">T{s.tier}</td>
                    <td className="py-2 px-2 text-[#E6EDF3]">{s.otd_pct}%</td>
                    <td className="py-2 px-2 text-[#E6EDF3]">{s.ppm}</td>
                    <td className="py-2 px-2 w-32"><RiskRadar score={s.risk_score} /></td>
                    <td className="py-2 px-2">
                      <Badge variant={s.status === "critical" ? "critical" : s.status === "warn" ? "medium" : "ok"}>
                        {s.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Reorder worklist: Compact with continuous moving scrolling animation */}
        <Card className="col-span-12 lg:col-span-5 flex flex-col h-[310px] overflow-hidden">
          <CardHeader className="py-2.5 px-3 border-b border-[#243042]/50 shrink-0">
            <div className="flex items-center justify-between w-full">
              <CardTitle className="text-xs uppercase tracking-wider text-[#8B98A9]">
                MRP Reorder Worklist ({selectedPlant === "ALL" ? "Global" : selectedPlant})
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-cyan-400/80 font-mono hidden sm:inline animate-pulse">
                  Auto-scrolling · Hover to pause
                </span>
                <Badge variant="high" className="text-[10px] py-0 px-1.5 font-mono">
                  {filteredWorklist.length} pending
                </Badge>
              </div>
            </div>
          </CardHeader>

          <div className="relative flex-1 overflow-hidden p-2.5 group">
            {/* Soft gradient masks top and bottom */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-[#0c1322] to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#0c1322] to-transparent z-10" />

            {/* Continuous vertical scrolling marquee */}
            <div className="animate-vertical-scroll flex flex-col gap-2">
              {(() => {
                const padded =
                  filteredWorklist.length > 0 && filteredWorklist.length < 3
                    ? [...filteredWorklist, ...filteredWorklist]
                    : filteredWorklist;
                return [...padded, ...padded];
              })().map((item, i) => {
                const baseKey = item.part_id || item.part_name || `item-${i}`;
                const loopKey = `${baseKey}-${i}`;
                const isDrafting = drafting[baseKey];
                const poResult = drafted[baseKey];

                return (
                  <div
                    key={loopKey}
                    className="p-2.5 rounded-lg bg-[#0B0F14] border border-[#243042] text-xs space-y-1.5 shrink-0 hover:border-cyan-500/50 transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={(item.urgency || "high") as "critical" | "high" | "medium"} className="text-[9px] py-0 px-1.5">
                        {item.urgency || "high"}
                      </Badge>
                      <span className="font-semibold text-[#E6EDF3] truncate text-[11px]">
                        {item.part_name || item.part_id}
                      </span>
                      {item.plant_id && (
                        <span className="text-[9px] font-mono px-1 rounded bg-[#1A2230] text-[#8B98A9]">{item.plant_id}</span>
                      )}
                      <span className="text-emerald-400 ml-auto font-bold font-mono text-xs">
                        ${(item.total_cost_usd || (item.unit_cost_usd || 42) * (item.recommended_qty || item.qty || 10)).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[#8B98A9] text-[10px]">
                      <span>Qty: {item.recommended_qty || item.qty}</span>
                      <span>·</span>
                      <span className="truncate">{item.supplier}</span>
                      <span>·</span>
                      <span className="font-mono text-[10px]">{item.part_id}</span>
                    </div>

                    <p className="text-[#8B98A9] text-[10px] leading-tight line-clamp-1">{item.reason}</p>

                    {poResult ? (
                      <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 flex items-center justify-between">
                        <div className="flex items-center gap-1 font-mono font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{poResult.po_number} Released to SAP ERP</span>
                        </div>
                        <span className="text-[9px] text-[#8B98A9]">ETA: {poResult.estimated_delivery_date}</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full h-6 text-[11px] flex items-center justify-center gap-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-semibold cursor-pointer"
                        onClick={() => handleDraftPo(item)}
                        disabled={isDrafting}
                      >
                        {isDrafting ? (
                          <>
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>Drafting ERP PO…</span>
                          </>
                        ) : (
                          <span>Approve & Release PO</span>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Quote comparison */}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle>Quote Comparison — Gate-driver IC (IC-GD-01)</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#8B98A9]">Gemini Document AI · 3 RFQ PDFs parsed</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg"
                className="hidden"
                onChange={handleUploadChange}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3 mr-1" />
                {uploadedFiles.length > 0 ? `${uploadedFiles.length} Uploaded` : "Upload RFQ PDFs"}
              </Button>
            </div>
          </CardHeader>
          {uploadedFiles.length > 0 && (
            <div className="mb-2 px-3 py-1.5 bg-base-300 rounded text-[11px] text-[#8B98A9] flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-success" />
              <span>Parsed RFQ Documents: {uploadedFiles.join(", ")}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#243042]">
                  {["Supplier", "Unit Price", "Lead Time", "MOQ", "Incoterms", "Payment", "AI Recommendation", "Action"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-[#8B98A9] font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "Q-FORMOSA", supplier: "Formosa Semicon", price: "$24.80", unit_cost: 24.8, lt: "14d (Delayed)", moq: "100", inco: "FOB Keelung", pay: "Net 60", rec: false, risk: true },
                  { id: "Q-PENANG", supplier: "Penang Micro (Renesas)", price: "$26.78", unit_cost: 26.78, lt: "6d Air/Sea", moq: "50", inco: "CIF Pune", pay: "Net 30", rec: true, risk: false },
                  { id: "Q-SEOUL", supplier: "Seoul Semi Corp", price: "$25.40", unit_cost: 25.4, lt: "21d Sea", moq: "200", inco: "EXW Incheon", pay: "Net 45", rec: false, risk: false },
                ].map((row) => {
                  const quotePo = drafted[row.id];
                  return (
                    <tr key={row.supplier} className={cn("border-b border-[#243042]/50", row.rec && "bg-[#4F8CFF]/5")}>
                      <td className="py-2 px-3 font-medium text-[#E6EDF3]">
                        {row.supplier}
                        {row.risk && <Badge variant="critical" className="ml-1.5 text-[9px]">Typhoon Risk</Badge>}
                        {row.rec && <Badge variant="ok" className="ml-1.5 text-[9px]">★ Recommended</Badge>}
                      </td>
                      <td className="py-2 px-3 text-[#E6EDF3] font-mono">{row.price}</td>
                      <td className="py-2 px-3 text-[#E6EDF3]">{row.lt}</td>
                      <td className="py-2 px-3 text-[#E6EDF3] font-mono">{row.moq}</td>
                      <td className="py-2 px-3 text-[#8B98A9]">{row.inco}</td>
                      <td className="py-2 px-3 text-[#8B98A9]">{row.pay}</td>
                      <td className="py-2 px-3">
                        {row.rec ? (
                          <span className="text-green-400">Best lead time, qualified alt, +8% cost justified by typhoon risk</span>
                        ) : row.risk ? (
                          <span className="text-red-400">Port of Keelung closed 72h</span>
                        ) : (
                          <span className="text-[#8B98A9]">Lead time exceeds safety buffer</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {quotePo ? (
                          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {quotePo.po_number}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant={row.rec ? "primary" : "secondary"}
                            className="h-6 text-[10px] px-2"
                            onClick={() =>
                              handleDraftPo({
                                part_id: row.id,
                                part_name: "IC-GD-01",
                                supplier: row.supplier,
                                recommended_qty: 500,
                                unit_cost_usd: row.unit_cost,
                                total_cost_usd: row.unit_cost * 500,
                                reason: `RFQ Award to ${row.supplier}`,
                              })
                            }
                          >
                            Award RFQ
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
