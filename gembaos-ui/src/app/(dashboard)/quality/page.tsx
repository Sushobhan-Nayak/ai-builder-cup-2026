"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, CheckCircle, XCircle, UploadCloud, RefreshCw, Eye, FileText } from "lucide-react";
import { postInspection, submitInspectionFeedback, generate8DReport } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { EightDReportModal } from "@/components/dashboard/eight-d-report-modal";

export interface DefectItem {
  id: string;
  lot: string;
  sku: string;
  ts: string;
  is_defect: boolean;
  defect_type: string | null;
  severity: "critical" | "high" | "medium" | "low" | null;
  confidence: number;
  plant: string;
}

const DEFECT_IMAGES: DefectItem[] = [
  // Rayong (RYG) - Die Casting
  { id: "img_001", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:12:00Z", is_defect: true, defect_type: "porosity", severity: "high", confidence: 0.94, plant: "RYG" },
  { id: "img_002", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:14:00Z", is_defect: true, defect_type: "porosity", severity: "medium", confidence: 0.88, plant: "RYG" },
  { id: "img_003", lot: "L-4470", sku: "HSG-220", ts: "2026-10-15T04:50:00Z", is_defect: false, defect_type: null, severity: null, confidence: 0.97, plant: "RYG" },
  { id: "img_004", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:18:00Z", is_defect: true, defect_type: "cold_shut", severity: "medium", confidence: 0.85, plant: "RYG" },
  { id: "img_005", lot: "L-4472", sku: "HSG-220", ts: "2026-10-15T05:45:00Z", is_defect: false, defect_type: null, severity: null, confidence: 0.99, plant: "RYG" },
  { id: "img_006", lot: "L-4472", sku: "HSG-220", ts: "2026-10-15T05:47:00Z", is_defect: true, defect_type: "flash", severity: "low", confidence: 0.82, plant: "RYG" },

  // Pune (PNQ) - e-Powertrain Assembly & Machining
  { id: "img_pnq_1", lot: "L-8820", sku: "TM-300", ts: "2026-10-15T06:10:00Z", is_defect: true, defect_type: "burr", severity: "high", confidence: 0.92, plant: "PNQ" },
  { id: "img_pnq_2", lot: "L-8820", sku: "TM-300", ts: "2026-10-15T06:14:00Z", is_defect: true, defect_type: "bearing_scuff", severity: "high", confidence: 0.89, plant: "PNQ" },
  { id: "img_pnq_3", lot: "L-8819", sku: "TM-300", ts: "2026-10-15T05:50:00Z", is_defect: false, defect_type: null, severity: null, confidence: 0.98, plant: "PNQ" },
  { id: "img_pnq_4", lot: "L-8821", sku: "TM-300", ts: "2026-10-15T06:30:00Z", is_defect: true, defect_type: "burr", severity: "low", confidence: 0.79, plant: "PNQ" },

  // Nagoya (NGO) - High-Precision Gearbox Grinding
  { id: "img_ngo_1", lot: "L-3105", sku: "GBX-100", ts: "2026-10-15T07:05:00Z", is_defect: true, defect_type: "gear_pitting", severity: "high", confidence: 0.93, plant: "NGO" },
  { id: "img_ngo_2", lot: "L-3105", sku: "GBX-100", ts: "2026-10-15T07:12:00Z", is_defect: false, defect_type: null, severity: null, confidence: 0.99, plant: "NGO" },
  { id: "img_ngo_3", lot: "L-3106", sku: "GBX-100", ts: "2026-10-15T07:28:00Z", is_defect: true, defect_type: "tooth_wear", severity: "medium", confidence: 0.86, plant: "NGO" },
];

const DEFECT_COLORS: Record<string, string> = {
  porosity: "#EF4444",
  cold_shut: "#F59E0B",
  flash: "#38BDF8",
  burr: "#F97316",
  bearing_scuff: "#EC4899",
  gear_pitting: "#EF4444",
  tooth_wear: "#F59E0B",
  crack: "#8B5CF6",
};

interface DefectDetailsMeta {
  rationale: string;
  box: { top: string; left: string; width: string; height: string };
  correlations: string[];
  recommendation: string;
  causes: Record<string, string[]>;
}

const DEFECT_DETAILS: Record<string, DefectDetailsMeta> = {
  porosity: {
    rationale: "Subsurface void cluster detected in upper-left quadrant. Consistent with gas porosity from die temperature below setpoint. Bounding box at [ymin:120, xmin:150, ymax:240, xmax:290].",
    box: { top: "15%", left: "20%", width: "45%", height: "50%" },
    correlations: [
      "• Die temp drifted −18°C over 4h (DCM-02 thermocouple)",
      "• Shot-sleeve maintenance overdue by 12 days",
      "• Porosity rate: 0% when temp > setpoint, 67% when < setpoint−15°C",
    ],
    recommendation: "100% X-ray inspection of lot L-4471 (42 parts). Hold shipment pending QE sign-off.",
    causes: {
      Machine: ["Die temp drift −18°C", "Shot-sleeve worn"],
      Material: ["Aluminium alloy batch variance"],
      Method: ["Injection pressure low"],
      Measurement: ["Thermocouple calibration due"],
      Man: ["Shift handover gap"],
      Environment: ["Ambient temp +4°C"],
    },
  },
  cold_shut: {
    rationale: "Discontinuous seam line detected at cavity flow junction. Metal streams failed to fuse completely due to low 2nd-stage injection speed.",
    box: { top: "32%", left: "35%", width: "45%", height: "38%" },
    correlations: [
      "• Plunger velocity dropped 14% on 2nd phase injection",
      "• Gate runner temperature measured at 610°C (nominal 645°C)",
      "• Hydraulic accumulator pressure fluctuation on DCM-02",
    ],
    recommendation: "Quarantine affected lot. Increase shot-sleeve velocity by 0.4 m/s and verify accumulator nitrogen pre-charge.",
    causes: {
      Machine: ["Accumulator pressure drop", "Plunger seal friction"],
      Material: ["Alloy liquidus temperature high"],
      Method: ["Second phase injection slow"],
      Measurement: ["Flow velocity sensor uncalibrated"],
      Man: ["No operator intervention on slow shot alarm"],
      Environment: ["Mold cooling cycle excessive"],
    },
  },
  flash: {
    rationale: "Excess metal fin extruded beyond parting line boundary (thickness 0.85mm vs 0.20mm tolerance limit). Bounding box along top-right edge.",
    box: { top: "8%", left: "60%", width: "35%", height: "35%" },
    correlations: [
      "• Die locking force decayed by 8% over last 120 cycles",
      "• Parting line debris accumulation detected at ejector pins",
      "• Tie bar strain gauge delta: +120 microstrain unbalance",
    ],
    recommendation: "Schedule robotic deburring trim-cell adjustment; inspect die face for particulate buildup.",
    causes: {
      Machine: ["Tie bar tension unbalance", "Hydraulic clamp drift"],
      Material: ["High molten metal fluidity"],
      Method: ["Clamping pressure below recipe"],
      Measurement: ["Tonnage gauge drift"],
      Man: ["Parting line cleaning skipped"],
      Environment: ["Thermal expansion in platen"],
    },
  },
  burr: {
    rationale: "Raised metal edge burr along keyway spline exceeding 0.15mm chamfer limit. Tool nose radius wear detected on CNC-07.",
    box: { top: "25%", left: "28%", width: "48%", height: "45%" },
    correlations: [
      "• Spindle CNC-07 vibration RMS elevated to 2.82 mm/s",
      "• Carbide end mill insert edge chipped (cycle count: 4,820)",
      "• Surface roughness Ra increased from 0.8µm to 2.4µm",
    ],
    recommendation: "Automated tool offset compensation and immediate tool change to carbide end mill T-04.",
    causes: {
      Machine: ["Spindle bearing vibration", "Tool wear on T-04"],
      Material: ["Hard spot in rotor steel"],
      Method: ["Feed rate too aggressive"],
      Measurement: ["In-situ touch probe offset expired"],
      Man: ["Tool life counter overridden"],
      Environment: ["Cutting fluid temperature +6°C"],
    },
  },
  bearing_scuff: {
    rationale: "Micro-pitting and circumferential galling on bearing journal race. High-frequency ultrasonic spike detected.",
    box: { top: "20%", left: "25%", width: "52%", height: "48%" },
    correlations: [
      "• High-frequency shock pulse dBm at 42 (spalling threshold 35)",
      "• Grease starvation event logged 3 shifts prior",
      "• Bearing cage temperature running at 72°C",
    ],
    recommendation: "Quarantine shaft assembly lot L-8820. Replace spindle bearing BRG-6205 at Thu 14:00 blackout.",
    causes: {
      Machine: ["Bearing fatigue outer-race (BPFO)", "Misalignment"],
      Material: ["Lubricant viscosity breakdown"],
      Method: ["Over-torqued locknut"],
      Measurement: ["Vibration sensor mount loose"],
      Man: ["Grease repack omitted during last PM"],
      Environment: ["Elevated ambient temperature"],
    },
  },
  gear_pitting: {
    rationale: "Surface contact fatigue pitting along pitch circle of planetary sun gear teeth. Micro-crater clusters visible under darkfield vision.",
    box: { top: "28%", left: "30%", width: "45%", height: "42%" },
    correlations: [
      "• Gear grinding wheel dresser wear logged on NGO-GRD-01",
      "• Quenching bath temperature deviated +6°C in Heat Treat Furnace 02",
      "• Surface hardness measured 56 HRC (spec: 60-62 HRC)",
    ],
    recommendation: "Hold gearbox lot L-3105. Conduct metallographic inspection and furnace atmosphere check.",
    causes: {
      Machine: ["Grinding wheel profile wear", "Furnace quench pump"],
      Material: ["Carburizing depth variance"],
      Method: ["Quench delay timing +8s"],
      Measurement: ["Rockwell hardness tester calibration"],
      Man: ["Furnace tray loading density high"],
      Environment: ["Quench oil degradation"],
    },
  },
  tooth_wear: {
    rationale: "Progressive abrasive wear on active flank profile causing backlash expansion (+0.04mm). Lead crowning profile degraded.",
    box: { top: "26%", left: "34%", width: "42%", height: "40%" },
    correlations: [
      "• Gear honing cycle duration shortened by 12s in shift 2",
      "• Grinding coolant concentration dropped to 4.2% (target 8%)",
      "• Contact pattern shifted toward tooth tip",
    ],
    recommendation: "Recalibrate gear flank lead crowning; top up synthetic grinding coolant concentration.",
    causes: {
      Machine: ["Honing stone glazing", "Coolant nozzle clogging"],
      Material: ["Abrasive swarf in recirculation"],
      Method: ["Shortened finishing dwell"],
      Measurement: ["Gear roll tester backlash sensor"],
      Man: ["Coolant refractometer check skipped"],
      Environment: ["Grinding fluid foaming"],
    },
  },
};

const DEFAULT_PASS_DETAIL: DefectDetailsMeta = {
  rationale: "Zero geometric anomalies or surface defects detected. Parting line, wall thickness, and surface roughness conform 100% to CAD master inspection limits.",
  box: { top: "0%", left: "0%", width: "0%", height: "0%" },
  correlations: [
    "• Process parameters within 6-sigma Cpk limits (Cpk = 1.62)",
    "• Thermocouple, hydraulic pressure, and spindle RMS nominal",
    "• Zero defect rate confirmed across lot sampling",
  ],
  recommendation: "Release lot to automated downstream machining and assembly cell.",
  causes: {
    Machine: ["All parameters nominal"],
    Material: ["Batch certified within spec"],
    Method: ["Standard recipe validated"],
    Measurement: ["Gauges verified and calibrated"],
    Man: ["Certified operator logged"],
    Environment: ["Cleanroom & ambient nominal"],
  },
};

function DefectCard({
  img,
  selected,
  onClick,
}: {
  img: DefectItem;
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
        <div className="flex items-center justify-between text-[10px] text-[#8B98A9] mt-0.5">
          <span className="font-mono">{img.lot}</span>
          <span className="font-semibold text-primary">{img.plant}</span>
        </div>
      </div>
    </button>
  );
}

function Fishbone({ defectMeta, defectTitle }: { defectMeta: DefectDetailsMeta; defectTitle: string }) {
  const causes = defectMeta.causes;
  return (
    <div className="space-y-2">
      <div className="text-center">
        <div className="inline-block bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-2 text-xs font-semibold text-red-400">
          Effect: {defectTitle}
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
      <p className="text-[10px] text-[#A78BFA]">[ev:sql-8] [ev:sql-9] [ev:doc-sop-dcm] — AI-generated RCA, verified by Inspector Agent</p>
    </div>
  );
}

export default function QualityStudio() {
  const { selectedPlant } = useAppStore();
  const [selected, setSelected] = useState<DefectItem>(DEFECT_IMAGES[0]);
  const [showRca, setShowRca] = useState(false);
  const [labeled, setLabeled] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<any>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEightD, setShowEightD] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const filteredImages = selectedPlant === "ALL"
    ? DEFECT_IMAGES
    : DEFECT_IMAGES.filter((img) => img.plant === selectedPlant);

  // Synchronize selection when plant filter changes
  useEffect(() => {
    if (filteredImages.length > 0 && !filteredImages.some((img) => img.id === selected.id)) {
      setSelected(filteredImages[0]);
      setUploadedPreview(null);
    }
  }, [selectedPlant, filteredImages, selected.id]);

  const handleGenerate8D = async () => {
    setGeneratingPdf(true);
    try {
      await generate8DReport(selected.lot, selected.sku);
    } catch (err) {
      console.warn("8D report backend call notice:", err);
    } finally {
      setGeneratingPdf(false);
      setShowEightD(true);
    }
  };

  const handleLabelFeedback = async (inspectionId: string, label: "correct" | "wrong") => {
    setLabeled((prev) => ({ ...prev, [inspectionId]: label }));
    try {
      await submitInspectionFeedback(inspectionId, label);
    } catch (err) {
      console.warn("Feedback recording error:", err);
    }
  };

  const activeMeta: DefectDetailsMeta = selected.defect_type && DEFECT_DETAILS[selected.defect_type]
    ? DEFECT_DETAILS[selected.defect_type]
    : selected.is_defect
    ? DEFECT_DETAILS.porosity
    : DEFAULT_PASS_DETAIL;

  const totalInspected = filteredImages.length + (inspectionResult ? 1 : 0);
  const totalDefects = filteredImages.filter((img) => img.is_defect).length + (inspectionResult?.defects_found ? 1 : 0);
  const defectRate = totalInspected > 0 ? ((totalDefects / totalInspected) * 100).toFixed(1) + "%" : "0.0%";
  const avgConfidence = totalInspected > 0 ? (filteredImages.reduce((acc, curr) => acc + curr.confidence, 0) / filteredImages.length * 100).toFixed(0) + "%" : "91%";

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
            {totalDefects} Defects Detected
          </span>
        </div>

        {/* Horizontal Ticker Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full scrollbar-none py-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#1e293b] bg-[#050912] text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Inspected:</span>
            <span className="font-bold text-[#E6EDF3] font-mono">{totalInspected} images</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-500/40 bg-red-950/30 text-red-200 text-[11px] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
            <span className="text-red-300">Defects:</span>
            <span className="font-bold font-mono">{totalDefects} detected</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-500/40 bg-red-950/30 text-red-200 text-[11px] shrink-0">
            <span className="text-red-300">Defect Rate:</span>
            <span className="font-bold font-mono text-red-400">{defectRate}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#1e293b] bg-[#050912] text-[11px] shrink-0">
            <span className="text-[#8B98A9]">Model Confidence:</span>
            <span className="font-bold text-emerald-400 font-mono">{avgConfidence}</span>
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
            <span className="text-[10px] text-[#8B98A9]">
              {selectedPlant === "ALL" ? "All Sites" : `${selectedPlant} Plant`} · {filteredImages.length} Samples
            </span>
          </CardHeader>
          <div className="grid grid-cols-2 gap-2">
            {filteredImages.map((img) => (
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

              {/* Dynamic Bounding box overlay */}
              {(selected.is_defect || inspectionResult?.boxes?.length) && (
                <div
                  className="absolute border-2 rounded pointer-events-none transition-all duration-300"
                  style={{
                    top: activeMeta.box.top,
                    left: activeMeta.box.left,
                    width: activeMeta.box.width,
                    height: activeMeta.box.height,
                    borderColor: DEFECT_COLORS[selected.defect_type || ""] || "#EF4444",
                    backgroundColor: `${DEFECT_COLORS[selected.defect_type || ""] || "#EF4444"}20`,
                  }}
                >
                  <span
                    className="absolute -top-4 left-0 text-[9px] text-white px-1.5 py-0.2 rounded font-mono font-semibold"
                    style={{ backgroundColor: DEFECT_COLORS[selected.defect_type || ""] || "#EF4444" }}
                  >
                    {selected.defect_type || "defect"} ({(selected.confidence || 0.9).toFixed(2)})
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
                { label: "Plant / Site", value: selected.plant },
                { label: "SKU", value: selected.sku },
                { label: "Defect type", value: selected.defect_type || "None (Conforming)" },
                { label: "Severity", value: selected.severity ? selected.severity.toUpperCase() : "PASS" },
                { label: "Confidence", value: `${Math.round((selected.confidence || 0) * 100)}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[#8B98A9]">{label}</span>
                  <span className="text-[#E6EDF3] font-medium font-mono">{value}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-2.5 text-[11px] text-[#8B98A9]">
              <p className="font-medium text-[#E6EDF3] mb-1">
                {selected.is_defect ? "Visual Rationale" : "Conformity Assessment"}
              </p>
              <p className="leading-relaxed">
                {activeMeta.rationale}
              </p>
            </div>

            {/* Human label verification */}
            {!labeled[selected.id] ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  className="flex-1"
                  onClick={() => handleLabelFeedback(selected.id, "correct")}
                >
                  <CheckCircle className="w-3 h-3" /> Correct
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="flex-1"
                  onClick={() => handleLabelFeedback(selected.id, "wrong")}
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
            <Fishbone
              defectMeta={activeMeta}
              defectTitle={`${(selected.defect_type || "Defect").toUpperCase()} on ${selected.sku} (Lot ${selected.lot})`}
            />
          ) : (
            <div className="space-y-3">
              <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3 text-xs">
                <p className="font-medium text-[#E6EDF3] mb-1.5">Correlation findings</p>
                <div className="space-y-1.5 text-[#8B98A9]">
                  {activeMeta.correlations.map((c, i) => (
                    <p key={i}>{c}</p>
                  ))}
                </div>
                <p className="text-[#A78BFA] mt-2 text-[10px]">[ev:sql-8] [ev:sql-9] [ev:gemini-cv]</p>
              </div>
              <div className="bg-[#0B0F14] border border-[#243042] rounded-lg p-3 text-xs">
                <p className="font-medium text-[#E6EDF3] mb-1.5">Containment recommendation</p>
                <p className="text-[#8B98A9] leading-relaxed">
                  {activeMeta.recommendation}
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                className="w-full shadow-sm font-semibold flex items-center justify-center gap-1.5"
                onClick={handleGenerate8D}
                disabled={generatingPdf}
              >
                {generatingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Compiling 8D Dossier...
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" /> Generate 8D Report PDF
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* 8D Problem Solving Dossier Modal */}
      <EightDReportModal
        isOpen={showEightD}
        onClose={() => setShowEightD(false)}
        lot={selected.lot}
        sku={selected.sku}
        defectType={selected.defect_type || "porosity"}
        severity={selected.severity || "high"}
        confidence={selected.confidence || 0.91}
        plant={selected.plant || "RYG"}
      />
    </div>
  );
}
