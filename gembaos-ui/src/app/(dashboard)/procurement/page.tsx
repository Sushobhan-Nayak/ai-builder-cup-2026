"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPLIERS } from "@/lib/mock-data";
import { ShoppingCart, Upload, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { draftPo, fetchReorderWorklist, type ReorderItem, type DraftPoResponse } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

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

        {/* Reorder worklist */}
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader>
            <CardTitle>Reorder Worklist (Dynamic)</CardTitle>
            <Badge variant="high">{worklist.length} pending</Badge>
          </CardHeader>
          <div className="space-y-2.5">
            {worklist.map((item, i) => {
              const key = item.part_id || item.part_name;
              const isDrafting = drafting[key];
              const poResult = drafted[key];

              return (
                <div key={i} className="p-3 rounded-lg bg-[#0B0F14] border border-[#243042] text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.urgency as "critical" | "high" | "medium"}>{item.urgency}</Badge>
                    <span className="font-semibold text-[#E6EDF3]">{item.part_name || item.part_id}</span>
                    <span className="text-green-400 ml-auto font-bold">
                      ${(item.total_cost_usd || item.unit_cost_usd * (item.recommended_qty || item.qty || 10)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#8B98A9]">
                    <span>Qty: {item.recommended_qty || item.qty}</span>
                    <span>·</span>
                    <span>{item.supplier}</span>
                    {item.location_bin && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[10px]">Bin {item.location_bin}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[#8B98A9]">{item.reason}</p>

                  {poResult ? (
                    <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-[11px] text-green-400 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{poResult.po_number} Staged</span>
                      </div>
                      <span className="text-[10px] text-[#8B98A9]">Est: {poResult.estimated_delivery_date}</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full flex items-center justify-center gap-1.5"
                      onClick={() => handleDraftPo(item)}
                      disabled={isDrafting}
                    >
                      {isDrafting ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Drafting ERP PO…</span>
                        </>
                      ) : (
                        <span>Draft PO (POST /v1/procurement/draft-po)</span>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Quote comparison */}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle>Quote Comparison — Gate-driver IC</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#8B98A9]">Gemini document AI · 3 PDFs parsed</span>
              <Button size="sm" variant="secondary">
                <Upload className="w-3 h-3" /> Upload PDFs
              </Button>
            </div>
          </CardHeader>
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
