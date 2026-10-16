"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Upload, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { draftPo, fetchReorderWorklist, type ReorderItem, type DraftPoResponse } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

const SUPPLIERS = [
  { id: "SUP-FORMOSA", name: "Formosa Semicon", country: "Taiwan", city: "Hsinchu", risk_score: 8.2, otd_pct: 94, ppm: 120, tier: 1, status: "critical" },
  { id: "SUP-PENANG", name: "Penang Micro", country: "Malaysia", city: "Penang", risk_score: 3.1, otd_pct: 97, ppm: 45, tier: 1, status: "ok" },
  { id: "SUP-NSK", name: "NSK Japan", country: "Japan", city: "Tokyo", risk_score: 1.8, otd_pct: 99, ppm: 12, tier: 1, status: "ok" },
  { id: "SUP-BAOTOU", name: "Baotou Magnetics", country: "China", city: "Baotou", risk_score: 5.4, otd_pct: 91, ppm: 280, tier: 2, status: "warn" },
  { id: "SUP-VIET", name: "Hanoi Copper Wire", country: "Vietnam", city: "Hanoi", risk_score: 2.9, otd_pct: 96, ppm: 65, tier: 2, status: "ok" },
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
  { part_id: "BRG-6205", part_name: "Bearing 6205", recommended_qty: 20, supplier: "NSK Japan", unit_cost_usd: 42.0, total_cost_usd: 840, urgency: "critical", reason: "PNQ-CNC-07 maintenance buffer" },
  { part_id: "IC-GD-01", part_name: "Gate-driver IC", recommended_qty: 500, supplier: "Penang Micro (alt)", unit_cost_usd: 24.8, total_cost_usd: 12400, urgency: "high", reason: "Typhoon risk buffer" },
  { part_id: "AL-A380-INGOT", part_name: "Shot sleeve / Ingot", recommended_qty: 10, supplier: "Thai Smelting Co", unit_cost_usd: 2450.0, total_cost_usd: 24500, urgency: "medium", reason: "Weekly replenishment buffer" },
];

export default function Procurement() {
  const { selectedPlant } = useAppStore();
  const [worklist, setWorklist] = useState<any[]>(DEFAULT_WORKLIST);
  const [drafting, setDrafting] = useState<Record<string, boolean>>({});
  const [drafted, setDrafted] = useState<Record<string, DraftPoResponse>>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
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
      }
    });
    return () => {
      mounted = false;
    };
  }, [selectedPlant]);

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
      setDrafted((prev) => ({ ...prev, [key]: res }));
    } catch (err) {
      console.error("Failed to draft PO:", err);
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
        <span className="text-xs text-[#8B98A9] ml-auto font-mono">
          Endpoint: POST /v1/procurement/draft-po · ERP Governance
        </span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Supplier scorecard */}
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader>
            <CardTitle>Supplier Scorecard</CardTitle>
            <span className="text-[10px] text-[#8B98A9]">25 suppliers · risk-sorted</span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#243042]">
                  {["Supplier", "Country", "Tier", "OTD%", "PPM", "Risk Score", "Status"].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-[#8B98A9] font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUPPLIERS.map((s) => (
                  <tr key={s.id} className="border-b border-[#243042]/50 hover:bg-[#121821] cursor-pointer">
                    <td className="py-2 px-2 font-medium text-[#E6EDF3]">{s.name}</td>
                    <td className="py-2 px-2 text-[#8B98A9]">{s.country}</td>
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
        <Card className="col-span-12 lg:col-span-5 flex flex-col h-[295px] overflow-hidden">
          <CardHeader className="py-2.5 px-3 border-b border-[#243042]/50 shrink-0">
            <div className="flex items-center justify-between w-full">
              <CardTitle className="text-xs uppercase tracking-wider text-[#8B98A9]">
                Reorder Worklist (Dynamic)
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-cyan-400/80 font-mono hidden sm:inline animate-pulse">
                  Auto-scrolling · Hover to pause
                </span>
                <Badge variant="high" className="text-[10px] py-0 px-1.5 font-mono">
                  {worklist.length} pending
                </Badge>
              </div>
            </div>
          </CardHeader>

          <div className="relative flex-1 overflow-hidden p-2.5 group">
            {/* Soft gradient masks top and bottom */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[#0c1322] to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#0c1322] to-transparent z-10" />

            {/* Continuous vertical scrolling marquee */}
            <div className="animate-vertical-scroll flex flex-col gap-2">
              {(worklist.length > 0 ? [...worklist, ...worklist] : []).map((item, i) => {
                const key = `${item.part_id || item.part_name}-${i}`;
                const baseKey = item.part_id || item.part_name;
                const isDrafting = drafting[baseKey];
                const poResult = drafted[baseKey];

                return (
                  <div
                    key={key}
                    className="p-2.5 rounded-lg bg-[#0B0F14] border border-[#243042] text-xs space-y-1.5 shrink-0 hover:border-cyan-500/50 transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={item.urgency as "critical" | "high" | "medium"} className="text-[9px] py-0 px-1.5">
                        {item.urgency}
                      </Badge>
                      <span className="font-semibold text-[#E6EDF3] truncate text-[11px]">
                        {item.part_name || item.part_id}
                      </span>
                      <span className="text-emerald-400 ml-auto font-bold font-mono text-xs">
                        ${(item.total_cost_usd || item.unit_cost_usd * (item.recommended_qty || item.qty || 10)).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[#8B98A9] text-[10px]">
                      <span>Qty: {item.recommended_qty || item.qty}</span>
                      <span>·</span>
                      <span className="truncate">{item.supplier}</span>
                      {item.location_bin && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[9px]">Bin {item.location_bin}</span>
                        </>
                      )}
                    </div>

                    <p className="text-[#8B98A9] text-[10px] leading-tight line-clamp-1">{item.reason}</p>

                    {poResult ? (
                      <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 flex items-center justify-between">
                        <div className="flex items-center gap-1 font-mono font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{poResult.po_number} Staged</span>
                        </div>
                        <span className="text-[9px] text-[#8B98A9]">Est: {poResult.estimated_delivery_date}</span>
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
                          <span>Draft PO</span>
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
            <CardTitle>Quote Comparison — Gate-driver IC</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#8B98A9]">Gemini document AI · 3 PDFs parsed</span>
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
                {uploadedFiles.length > 0 ? `${uploadedFiles.length} Uploaded` : "Upload PDFs"}
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
                  {["Supplier", "Unit Price", "Lead Time", "MOQ", "Incoterms", "Payment", "AI Recommendation"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-[#8B98A9] font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { supplier: "Formosa Semicon", price: "$24.80", lt: "14d", moq: "100", inco: "FOB", pay: "Net 60", rec: false, risk: true },
                  { supplier: "Penang Micro", price: "$26.78", lt: "6d", moq: "50", inco: "CIF", pay: "Net 30", rec: true, risk: false },
                  { supplier: "Seoul Semi", price: "$25.40", lt: "21d", moq: "200", inco: "EXW", pay: "Net 45", rec: false, risk: false },
                ].map((row) => (
                  <tr key={row.supplier} className={cn("border-b border-[#243042]/50", row.rec && "bg-[#4F8CFF]/5")}>
                    <td className="py-2 px-3 font-medium text-[#E6EDF3]">
                      {row.supplier}
                      {row.risk && <Badge variant="critical" className="ml-1.5 text-[9px]">At risk</Badge>}
                      {row.rec && <Badge variant="ok" className="ml-1.5 text-[9px]">★ Recommended</Badge>}
                    </td>
                    <td className="py-2 px-3 text-[#E6EDF3]">{row.price}</td>
                    <td className="py-2 px-3 text-[#E6EDF3]">{row.lt}</td>
                    <td className="py-2 px-3 text-[#E6EDF3]">{row.moq}</td>
                    <td className="py-2 px-3 text-[#8B98A9]">{row.inco}</td>
                    <td className="py-2 px-3 text-[#8B98A9]">{row.pay}</td>
                    <td className="py-2 px-3">
                      {row.rec ? <span className="text-green-400">Best lead time, qualified alt, +8% cost justified by typhoon risk</span> : "—"}
                    </td>
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
