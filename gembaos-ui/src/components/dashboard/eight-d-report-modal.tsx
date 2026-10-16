"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, ShieldAlert, CheckCircle2, FileText } from "lucide-react";

interface EightDReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lot: string;
  sku: string;
  defectType: string;
  severity: string;
  confidence: number;
  plant: string;
}

export function EightDReportModal({
  isOpen,
  onClose,
  lot,
  sku,
  defectType,
  severity,
  confidence,
  plant,
}: EightDReportModalProps) {
  if (!isOpen) return null;

  const reportId = `8D-2026-${(lot || "L4471").replace("-", "")}-${(defectType || "POR").slice(0, 3).toUpperCase()}`;
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  const isBurr = defectType === "burr" || defectType === "bearing_scuff";
  const isColdShut = defectType === "cold_shut";
  const isPitting = defectType === "gear_pitting" || defectType === "tooth_wear";
  const machineName = plant === "PNQ" ? "PNQ-CNC-07 (Milling)" : plant === "NGO" ? "NGO-GRD-01 (Grinding)" : "RYG-DCM-02 (Die Cast)";

  const d3Containment = isBurr
    ? `100% CMM and optical comparator profiling of rotor shaft spline keyways in lot ${lot}. Physical quarantine enforced in Pune Bay B (Tag: HOLD-QE-${lot}). Immediate ERP shipment block.`
    : isColdShut
    ? `100% visual and ultrasonic inspection of lot ${lot}. Segregate parts in containment holding area (Tag: HOLD-QE-${lot}). ERP shipment block logged.`
    : isPitting
    ? `100% gear roll testing and lead tooth flank inspection of lot ${lot}. Parts quarantined in Nagoya Bay A (Tag: HOLD-QE-${lot}). ERP dispatch hold active.`
    : `100% X-ray inspection of all castings in lot ${lot}. Physical quarantine enforced in Raigad Bay C (Tag: HOLD-QE-${lot}). Immediate shipment block logged in ERP.`;

  const d4Whys = isBurr
    ? [
        "Why 1: Heavy burr extruded along keyway spline edge exceeding 0.15mm chamfer limit.",
        "Why 2: CNC-07 spindle vibration chatter caused tool edge micro-chipping during finishing pass.",
        "Why 3: Spindle outer-race bearing spalling generated 2.82 mm/s RMS vibration breach.",
        "Why 4: Bearing reached end-of-life (RUL dropped to 26.5h) without proactive replacement.",
        "Why 5 (Root Cause): Tool replacement cycle was extended beyond rated insert life without auto-lock.",
      ]
    : isColdShut
    ? [
        "Why 1: Cold shut seam formed where two molten metal streams met without fusing.",
        "Why 2: Second-stage injection velocity dropped below minimum threshold during cavity filling.",
        "Why 3: Hydraulic accumulator pressure dipped by 14% under consecutive heavy shot cycles.",
        "Why 4: Nitrogen bladder pre-charge decayed over time without sensor alarm.",
        "Why 5 (Root Cause): Bladder pressure verification protocol omitted from monthly checklist.",
      ]
    : isPitting
    ? [
        "Why 1: Surface contact fatigue pitting along pitch circle of planetary sun gear teeth.",
        "Why 2: Grinding wheel profile dresser wear logged on NGO-GRD-01 causing localized micro-stress.",
        "Why 3: Quenching bath temperature deviated +6°C in Heat Treat Furnace 02.",
        "Why 4: Synthetic coolant concentration dropped to 4.2% (target 8%).",
        "Why 5 (Root Cause): Coolant refractometer calibration overdue by 18 days.",
      ]
    : [
        "Why 1: Gas porosity void formed inside casting cavity during injection stroke.",
        "Why 2: Aluminum alloy experienced premature solidification front during mold cavity filling.",
        "Why 3: Die surface temperature drifted −18°C below nominal recipe setpoint over a 4-hour production run.",
        "Why 4: DCM-02 proportional cooling valve exhibited hysteresis from hydraulic seal wear, failing to throttle water jacket.",
        "Why 5 (Root Cause): Shot-sleeve preventative maintenance and valve calibration was overdue by 12 days.",
      ];

  const d5Pca = isBurr
    ? "Execute spindle bearing replacement (BRG-6205) during scheduled Thu 14:00 blackout. Replace carbide insert T-04."
    : isColdShut
    ? "Recharge accumulator nitrogen bladder to 110 bar. Install live pressure transducer with automated low-charge interlock."
    : isPitting
    ? "Dress gear grinding wheel and restore coolant concentration to 8.2%. Calibrate quenching bath temperature controller."
    : "Recalibrate DCM-02 proportional valve and replace thermocouple sensor probe with SKF hardened sensor. Install automated PLC thermal interlock.";

  const d6Val = isBurr
    ? "Post-maintenance vibration signature verified at 0.92 mm/s RMS (ISO Zone A). Edge burr measured at 0.02mm (within 0.10mm spec)."
    : isColdShut
    ? "50-cycle qualification run executed with continuous injection velocity logging; 100% sound fusion confirmed."
    : isPitting
    ? "Lead and involute gear flank accuracy measured at DIN Class 4; surface hardness certified at 61.2 HRC."
    : "Trial run of 50 castings produced with active PLC interlock; 100% X-ray verification yielded 0 defects (0.0% porosity). Cpk improved to 1.58.";

  const d7Prev = isBurr
    ? "Enforce automated tool life lock in CNC controller; link Sentinel bearing RUL to automated maintenance work order."
    : isColdShut
    ? "Incorporate automated accumulator pressure telemetry into Sentinel agent hourly anomaly watch."
    : isPitting
    ? "Mandate weekly automated digital refractometer logging in CMMS; install inline coolant monitoring sensor."
    : "Tighten shot-sleeve PM interval in CMMS from 30 to 14 days. Sentinel agent continuous BigQuery telemetry watch configured.";

  const handleDownloadJson = () => {
    const reportData = {
      standard: "IATF 16949 / QS-9000",
      report_id: reportId,
      date: currentDate,
      plant: plant || "RYG",
      line: `${plant || "RYG"} Production Line 1`,
      machine: machineName,
      part: {
        lot: lot || "L-4471",
        sku: sku || "HSG-220",
        defect: defectType || "porosity",
        severity: severity || "high",
        confidence: `${Math.round((confidence || 0.91) * 100)}%`,
      },
      disciplines: {
        D1_team: [
          { role: "Executive Champion", name: "Dr. Aris Thorne", title: "VP Quality Operations" },
          { role: "AI Vision Lead", name: "Inspector Agent", title: "GembaOS Vision AI" },
          { role: "Quality Engineer", name: "Rajesh K.", title: "Senior QE Lead" },
          { role: "Process Specialist", name: "Suresh P.", title: "Tooling & Thermal Engineer" },
        ],
        D2_problem_description: `Non-conformance (${defectType || "defect"}) detected in lot ${lot} (${sku}). Sampling confirmed non-conformance exceeding threshold (visual confidence ${Math.round((confidence || 0.91) * 100)}%).`,
        D3_interim_containment: d3Containment,
        D4_root_cause_analysis: {
          five_whys: d4Whys,
          evidence: ["ev:sql-8", "ev:sql-9", "ev:gemini-cv"],
        },
        D5_permanent_corrective_actions: d5Pca,
        D6_validation: d6Val,
        D7_prevent_recurrence: d7Prev,
        D8_team_recognition: "Formal sign-off approved by Quality Engineering and Manufacturing Operations.",
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0B0F14] border border-[#243042] rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Toolbar (hidden during print) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#243042] bg-[#121821] print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-[#E6EDF3] tracking-wide">
              8D Problem Solving Dossier
            </span>
            <Badge variant="critical" className="text-[10px]">
              D3 Containment Active
            </Badge>
            <Badge variant="default" className="text-[10px]">
              IATF 16949 / QS-9000
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleDownloadJson} className="h-7 text-xs">
              <Download className="w-3.5 h-3.5 mr-1" /> Export JSON
            </Button>
            <Button size="sm" variant="primary" onClick={handlePrint} className="h-7 text-xs shadow-sm">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print / Save PDF
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8B98A9] hover:text-white hover:bg-[#243042] transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable 8D Document Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-[#E6EDF3] print:p-8 print:bg-white print:text-black">
          {/* Header Banner */}
          <div className="border-b border-[#243042] pb-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold tracking-widest text-[#4F8CFF] uppercase">
                  GembaOS Quality Assurance System
                </span>
                <span className="text-xs text-[#8B98A9]">·</span>
                <span className="text-xs text-[#8B98A9]">{plant || "RYG"} Plant · Line 1</span>
              </div>
              <h1 className="text-base font-bold text-white mt-1">
                8D Corrective Action & Problem Solving Report
              </h1>
              <p className="text-[11px] text-[#8B98A9] mt-0.5">
                Standard: ISO/TS 16949 / QS-9000 Discipline 1-8 Corrective Action Process
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="font-mono font-bold text-white/90">{reportId}</p>
              <p className="text-[#8B98A9] mt-0.5 text-[11px]">{currentDate}</p>
              <p className="text-red-400 font-semibold mt-0.5 text-[11px]">SEVERITY: {(severity || "HIGH").toUpperCase()}</p>
            </div>
          </div>

          {/* D1: Team */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA] flex items-center gap-1.5">
              <span>D1</span> — Problem Solving Team
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-[#121821] border border-[#243042] p-2.5 rounded-lg">
                <p className="text-[10px] text-[#8B98A9]">Executive Champion</p>
                <p className="font-semibold text-white">Dr. Aris Thorne</p>
                <p className="text-[10px] text-[#8B98A9]">VP Quality Operations</p>
              </div>
              <div className="bg-[#121821] border border-[#243042] p-2.5 rounded-lg">
                <p className="text-[10px] text-[#8B98A9]">AI Vision Lead</p>
                <p className="font-semibold text-primary">Inspector Agent</p>
                <p className="text-[10px] text-[#8B98A9]">Gemini 3.8 Flash</p>
              </div>
              <div className="bg-[#121821] border border-[#243042] p-2.5 rounded-lg">
                <p className="text-[10px] text-[#8B98A9]">Quality Engineer</p>
                <p className="font-semibold text-white">Rajesh K.</p>
                <p className="text-[10px] text-[#8B98A9]">Senior QE Lead</p>
              </div>
              <div className="bg-[#121821] border border-[#243042] p-2.5 rounded-lg">
                <p className="text-[10px] text-[#8B98A9]">Process Specialist</p>
                <p className="font-semibold text-white">Suresh P.</p>
                <p className="text-[10px] text-[#8B98A9]">Tooling & DCM Lead</p>
              </div>
            </div>
          </div>

          {/* D2: Problem Description */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA] flex items-center gap-1.5">
              <span>D2</span> — Problem Description
            </h3>
            <div className="bg-[#121821] border border-[#243042] p-3 rounded-lg text-xs space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pb-2 border-b border-[#243042]">
                <div>
                  <span className="text-[#8B98A9]">Affected Lot:</span>{" "}
                  <strong className="text-white">{lot}</strong>
                </div>
                <div>
                  <span className="text-[#8B98A9]">Part SKU:</span>{" "}
                  <strong className="text-white">{sku} (Housing)</strong>
                </div>
                <div>
                  <span className="text-[#8B98A9]">Defect Mode:</span>{" "}
                  <strong className="text-red-400 uppercase">{defectType || "porosity"}</strong>
                </div>
                <div>
                  <span className="text-[#8B98A9]">AI Confidence:</span>{" "}
                  <strong className="text-white">{Math.round((confidence || 0.91) * 100)}%</strong>
                </div>
              </div>
              <p className="text-[#8B98A9] leading-relaxed">
                Visual inspection and automated CV telemetry identified non-conformance of type <strong className="text-red-400 uppercase">{defectType || "porosity"}</strong> in lot <strong>{lot}</strong> ({sku}). Bounding region confirmed at <strong>{Math.round((confidence || 0.91) * 100)}%</strong> confidence. Immediate containment protocol initiated.
              </p>
            </div>
          </div>

          {/* D3: Interim Containment Actions */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA] flex items-center gap-1.5">
              <span>D3</span> — Interim Containment Actions (ICA)
            </h3>
            <div className="bg-[#121821] border border-red-500/20 p-3 rounded-lg text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-red-400 font-semibold">
                <ShieldAlert className="w-4 h-4" />
                <span>100% Quarantine & Inspection Order Active</span>
              </div>
              <p className="text-[#8B98A9] leading-relaxed">
                {d3Containment}
              </p>
            </div>
          </div>

          {/* D4: Root Cause Analysis */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA] flex items-center gap-1.5">
              <span>D4</span> — Root Cause Analysis (5-Why & Ishikawa)
            </h3>
            <div className="bg-[#121821] border border-[#243042] p-3 rounded-lg text-xs space-y-1.5">
              <div className="space-y-1 text-[#8B98A9]">
                {d4Whys.map((why, idx) => (
                  <p key={idx}>{why}</p>
                ))}
              </div>
              <div className="flex gap-2 text-[10px] text-primary font-mono pt-1">
                <span>[ev:sql-8]</span>
                <span>[ev:sql-9]</span>
                <span>[ev:gemini-cv]</span>
              </div>
            </div>
          </div>

          {/* D5 & D6: Permanent Corrective Actions & Verification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
                <span>D5</span> — Chosen PCA
              </h3>
              <div className="bg-[#121821] border border-[#243042] p-3 rounded-lg text-xs text-[#8B98A9] space-y-1 leading-relaxed">
                <p>{d5Pca}</p>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
                <span>D6</span> — Validation of PCA
              </h3>
              <div className="bg-[#121821] border border-[#243042] p-3 rounded-lg text-xs text-[#8B98A9] space-y-1 leading-relaxed">
                <p className="text-green-400 font-semibold">• {d6Val}</p>
              </div>
            </div>
          </div>

          {/* D7 & D8: Recurrence Prevention & Sign-off */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
                <span>D7</span> — Prevent Recurrence
              </h3>
              <div className="bg-[#121821] border border-[#243042] p-3 rounded-lg text-xs text-[#8B98A9] space-y-1">
                <p>• Tighten DCM-02 shot-sleeve PM frequency from 30 to 14 days in CMMS.</p>
                <p>• Sentinel Agent real-time BigQuery telemetry watch configured with automated alert trigger.</p>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
                <span>D8</span> — Sign-Off & Verification
              </h3>
              <div className="bg-[#121821] border border-[#243042] p-3 rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between text-[#8B98A9]">
                  <span>Quality Assurance:</span>
                  <span className="text-green-400 font-mono flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED (Rajesh K.)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#8B98A9]">
                  <span>Plant Operations:</span>
                  <span className="text-green-400 font-mono flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED (Suresh P.)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-2.5 border-t border-[#243042] bg-[#121821] print:hidden">
          <span className="text-[11px] text-[#8B98A9]">
            Audit Hash: <span className="font-mono text-white/90">8d:a471-qms-2026</span>
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onClose} className="h-7 text-xs">
              Close
            </Button>
            <Button size="sm" variant="primary" onClick={handlePrint} className="h-7 text-xs shadow-sm">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
