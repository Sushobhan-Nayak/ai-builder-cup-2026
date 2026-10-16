"use client";
import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, CheckCircle, XCircle, UploadCloud, RefreshCw, Eye } from "lucide-react";
import { postInspection } from "@/lib/api-client";

const DEFECT_IMAGES = [
  { id: "img_001", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:12:00Z", is_defect: true, defect_type: "porosity", severity: "high", confidence: 0.91, plant: "RYG" },
  { id: "img_002", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:14:00Z", is_defect: true, defect_type: "porosity", severity: "medium", confidence: 0.84, plant: "RYG" },
  { id: "img_003", lot: "L-4470", sku: "HSG-220", ts: "2026-10-15T04:50:00Z", is_defect: false, defect_type: null, severity: null, confidence: 0.97, plant: "RYG" },
  { id: "img_004", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:18:00Z", is_defect: true, defect_type: "cold_shut", severity: "low", confidence: 0.76, plant: "RYG" },
  { id: "img_005", lot: "L-4472", sku: "HSG-220", ts: "2026-10-15T05:45:00Z", is_defect: false, defect_type: null, severity: null, confidence: 0.99, plant: "RYG" },
  { id: "img_006", lot: "L-4472", sku: "HSG-220", ts: "2026-10-15T05:47:00Z", is_defect: true, defect_type: "flash", severity: "low", confidence: 0.82, plant: "RYG" },
];

const DEFECT_COLORS: Record<string, string> = {
  porosity: "#EF4444",
  cold_shut: "#F59E0B",
  flash: "#38BDF8",
  crack: "#8B5CF6",
};

function DefectCard({
  img,
  selected,
  onClick,
}: {
  img: (typeof DEFECT_IMAGES)[0];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-xl border overflow-hidden transition-all text-left",
        selected ? "border-[#4F8CFF] shadow-sm" : "border-[#243042] hover:border-[#4F8CFF]/50"
      )}
    >
      <div
        className={cn(
          "w-full h-24 flex items-center justify-center text-3xl",
          img.is_defect
            ? "bg-gradient-to-br from-[#1A0A0A] to-[#2A1010]"
            : "bg-gradient-to-br from-[#0A1A0A] to-[#102A10]"
        )}
      >
        {img.is_defect ? "🔴" : "✅"}
        {img.is_defect && (
          <div
            className="absolute inset-4 border-2 rounded"
            style={{ borderColor: DEFECT_COLORS[img.defect_type || ""] || "#EF4444" }}
          />
        )}
      </div>
      <div className="p-2 bg-[#121821]">
        <div className="flex items-center gap-1 flex-wrap">
          {img.is_defect ? (
            <Badge variant="critical" className="text-[9px]">
              {img.defect_type}
            </Badge>
          ) : (
            <Badge variant="ok" className="text-[9px]">
              Pass
            </Badge>
          )}
          <span className="text-[9px] text-[#8B98A9] ml-auto font-mono">
            {Math.round((img.confidence || 0) * 100)}%
          </span>
        </div>
        <p className="text-[10px] text-[#8B98A9] mt-0.5 truncate">{img.lot}</p>
      </div>
    </button>
  );
}

function Fishbone() {
  const causes = {
    Machine: ["Die temp drift −18°C", "Shot-sleeve worn"],
    Material: ["Aluminium alloy batch variance"],
    Method: ["Injection pressure low"],
    Measurement: ["Thermocouple calibration due"],
    Man: ["Shift handover gap"],
    Environment: ["Ambient temp +4°C"],
  };
  return (
    <div className="space-y-2">
      <div className="text-center">
        <div className="inline-block bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-2 text-xs font-semibold text-red-400">
          Effect: Porosity defects on HSG-220 (lot L-4471)
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(causes).map(([cat, items]) => (
          <div key={cat} className="bg-[#0B0F14] border border-[#243042] rounded-lg p-2.5">
            <p className="text-[10px] font-semibold text-[#A78BFA] mb-1.5">{cat}</p>
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-[#8B98A9] mb-1">
                <span className="text-[#243042] mt-0.5">→</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[#A78BFA]">[ev:sql-8] [ev:sql-9] [ev:doc-sop-dcm] — AI-generated, pending QE review</p>
    </div>
  );
}

export default function QualityStudio() {
  const [selected, setSelected] = useState(DEFECT_IMAGES[0]);
  const [showRca, setShowRca] = useState(false);
  const [labeled, setLabeled] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<any>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const previewUrl = URL.createObjectURL(file);
    setUploadedPreview(previewUrl);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await postInspection(formData);
      setInspectionResult(res);
    } catch (err) {
      console.error("Inspection upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {/* 1. Header Bar with integrated Upload action */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Search className="w-4 h-4" />
          </div>
          <h1 className="text-sm sm:text-base font-bold text-[#E6EDF3]">Visual Quality Studio</h1>
          <Badge variant="default" className="text-[10px]">Inspector Agent</Badge>
          <span className="hidden lg:inline-block text-[10px] text-[#8B98A9] font-mono">
            POST /v1/inspections · 2-Stage CV
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <Button
            size="sm"
            variant="primary"
            className="h-8 text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" /> Upload & Inspect Image
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Compact Quality Runway Ticker */}
      <div className="rounded-xl bg-[#0c1322] border border-[#243042] px-3 py-1.5 shadow-md flex items-center justify-between gap-3 overflow-hidden text-xs">
        <div className="flex items-center gap-2 shrink-0 pr-2.5 border-r border-[#243042]">
          <span className="text-[11px] font-bold text-[#E6EDF3] uppercase tracking-wider hidden sm:inline">
            Quality Ticker
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
            4 Defects Detected
          </span>
        </div>

        {/* Horizontal Ticker Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full scrollbar-none py-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#1e293b] bg-[#050912] text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Inspected:</span>
            <span className="font-bold text-[#E6EDF3] font-mono">6 images</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-500/40 bg-red-950/30 text-red-200 text-[11px] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
            <span className="text-red-300">Defects:</span>
            <span className="font-bold font-mono">4 detected</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-500/40 bg-red-950/30 text-red-200 text-[11px] shrink-0">
            <span className="text-red-300">Defect Rate:</span>
            <span className="font-bold font-mono text-red-400">66.7%</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#1e293b] bg-[#050912] text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Model Confidence:</span>
            <span className="font-bold text-emerald-400 font-mono">91%</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#1e293b] bg-[#050912] text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Pipeline:</span>
            <span className="font-medium text-cyan-300 font-mono text-[10px]">Flash-Lite → Gemini 3.8 Flash</span>
          </div>
        </div>

        {inspectionResult && (
          <div className="shrink-0 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Inspection #{inspectionResult.inspection_id} ({inspectionResult.defects_found} defect)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Image feed */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <CardTitle>Inspection Lot Feed</CardTitle>
            <span className="text-[10px] text-[#8B98A9]">Lot L-4471</span>
          </CardHeader>
          <div className="grid grid-cols-2 gap-2">
            {DEFECT_IMAGES.map((img) => (
              <DefectCard
                key={img.id}
                img={img}
                selected={selected.id === img.id}
                onClick={() => {
                  setSelected(img);
                  setUploadedPreview(null);
                }}
              />
            ))}
          </div>
        </Card>

        {/* Image detail with 2D Bounding Box overlay */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <CardTitle>Inspection Canvas</CardTitle>
            <Badge variant={selected.is_defect ? "critical" : "ok"}>
              {selected.is_defect ? "Defect Found" : "Inspection Passed"}
            </Badge>
          </CardHeader>
          <div className="space-y-3">
            {/* Annotated Bounding Box Canvas */}
            <div
              className={cn(
                "w-full h-44 rounded-xl flex items-center justify-center text-5xl relative border overflow-hidden",
                selected.is_defect
                  ? "bg-gradient-to-br from-[#1A0A0A] to-[#2A1010] border-red-500/20"
                  : "bg-gradient-to-br from-[#0A1A0A] to-[#102A10] border-green-500/20"
              )}
            >
              {uploadedPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={uploadedPreview}
                  alt="Uploaded casting"
                  className="w-full h-full object-cover"
                />
              ) : selected.is_defect ? (
                "🔴"
              ) : (
                "✅"
              )}

              {/* Bounding box overlay returned from /v1/inspections */}
              {(selected.is_defect || inspectionResult?.boxes?.length) && (
                <div
                  className="absolute border-2 border-red-500 rounded bg-red-500/10 pointer-events-none"
                  style={{
                    top: "15%",
                    left: "20%",
                    width: "45%",
                    height: "50%",
                  }}
                >
                  <span className="absolute -top-4 left-0 text-[9px] bg-red-600 text-white px-1 rounded font-mono">
                    porosity (0.94)
                  </span>
                </div>
              )}

              <div className="absolute bottom-2 right-2 text-[10px] bg-[#121821]/90 border border-[#243042] px-2 py-0.5 rounded text-[#8B98A9]">
                Stage 2 Reasoning · Gemini 3.8 Flash
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              {[
                { label: "Lot", value: selected.lot },
                { label: "SKU", value: selected.sku },
                { label: "Defect type", value: selected.defect_type || "None" },
                { label: "Severity", value: selected.severity || "—" },
                { label: "Confidence", value: `${Math.round((selected.confidence || 0) * 100)}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[#8B98A9]">{label}</span>
                  <span className="text-[#E6EDF3] font-medium font-mono">{value}</span>
                </div>
              ))}
            </div>

            {selected.is_defect && (
              <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-2.5 text-[11px] text-[#8B98A9]">
                <p className="font-medium text-[#E6EDF3] mb-1">Visual Rationale</p>
                <p>
                  Subsurface void cluster detected in upper-left quadrant. Consistent with gas porosity from die temperature below setpoint. Bounding box at [ymin:120, xmin:150, ymax:240, xmax:290].
                </p>
              </div>
            )}

            {/* Human label verification */}
            {!labeled[selected.id] ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  className="flex-1"
                  onClick={() => setLabeled((p) => ({ ...p, [selected.id]: "correct" }))}
                >
                  <CheckCircle className="w-3 h-3" /> Correct
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="flex-1"
                  onClick={() => setLabeled((p) => ({ ...p, [selected.id]: "wrong" }))}
                >
                  <XCircle className="w-3 h-3" /> Wrong
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-green-400 flex items-center gap-1 font-mono">
                <CheckCircle className="w-3 h-3" /> Labeled: {labeled[selected.id]}
              </p>
            )}
          </div>
        </Card>

        {/* RCA */}
        <Card className="col-span-12 lg:col-span-4" glow>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-[#A78BFA]">🔍 Inspector</span> RCA Canvas
            </CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setShowRca(!showRca)}>
              {showRca ? "Hide" : "Root Cause →"}
            </Button>
          </CardHeader>
          {showRca ? (
            <Fishbone />
          ) : (
            <div className="space-y-3">
              <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3 text-xs">
                <p className="font-medium text-[#E6EDF3] mb-1.5">Correlation findings</p>
                <div className="space-y-1.5 text-[#8B98A9]">
                  <p>• Die temp drifted −18°C over 4h (DCM-02 thermocouple)</p>
                  <p>• Shot-sleeve maintenance overdue by 12 days</p>
                  <p>• Porosity rate: 0% when temp &gt; setpoint, 67% when &lt; setpoint−15°C</p>
                </div>
                <p className="text-[#A78BFA] mt-2 text-[10px]">[ev:sql-8] [ev:sql-9]</p>
              </div>
              <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3 text-xs">
                <p className="font-medium text-[#E6EDF3] mb-1.5">Containment recommendation</p>
                <p className="text-[#8B98A9]">
                  100% X-ray inspection of lot L-4471 (42 parts). Hold shipment pending QE sign-off.
                </p>
              </div>
              <Button size="sm" variant="secondary" className="w-full">
                Generate 8D Report PDF
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
