"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Swords,
  Network,
  ShieldCheck,
  ArrowRight,
  Activity,
  CloudLightning,
  AlertOctagon,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchDecisions,
  fetchBlastRadius,
  approveDecision,
  rejectDecision,
  triggerWarRoomDeliberation,
  type DecisionItem,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

interface WarRoomMessage {
  id: string;
  agent: string;
  icon: string;
  color: string;
  ts: string;
  text: string;
  evidence: string[];
  isScenario?: boolean;
}

interface WarRoomScenarioConfig {
  key: "typhoon_hsinchu" | "bearing_failure_cnc07";
  decisionId: string;
  badgeLabel: string;
  title: string;
  severity: "CRITICAL" | "HIGH";
  estValueProtected: string;
  triggerTitle: string;
  triggerSubtitle: string;
  metrics: { label: string; value: string; color: string }[];
  graphChain: string[];
  graphCitation: string;
  messages: WarRoomMessage[];
  criticSummary: string;
  options: {
    id: string;
    label: string;
    cost: string;
    otif: string;
    recommended: boolean;
    feasible: boolean;
    desc: string;
  }[];
  dispatchedActions: { id: string; text: string }[];
}

const SCENARIO_CONFIGS: Record<"typhoon_hsinchu" | "bearing_failure_cnc07", WarRoomScenarioConfig> = {
  typhoon_hsinchu: {
    key: "typhoon_hsinchu",
    decisionId: "dec_001",
    badgeLabel: "Typhoon Haikui-2 → Formosa Semicon",
    title: "Typhoon Haikui-2 Taiwan Supply Disruption",
    severity: "HIGH",
    estValueProtected: "$1,820k",
    triggerTitle: "Typhoon Haikui-2",
    triggerSubtitle: "Landfall p=0.80 in 48h near Hsinchu & Port of Keelung, Taiwan",
    metrics: [
      { label: "Supplier at risk", value: "Formosa Semicon (TW)", color: "text-red-400" },
      { label: "Parts affected", value: "2 (IC-GD-01, IC-CS-04)", color: "text-orange-400" },
      { label: "SKUs affected", value: "3 (TM-300, HSG-220)", color: "text-yellow-400" },
      { label: "Open orders", value: "11 sales orders", color: "text-[#E6EDF3]" },
      { label: "Revenue at risk", value: "$1,820k", color: "text-red-400" },
      { label: "Stock-out in", value: "9 days", color: "text-red-400" },
    ],
    graphChain: ["Formosa", "IC-GD-01", "TM-300", "SO-1001", "Tata & Kirin"],
    graphCitation: "[ev:gql-1] BigQuery Graph 5-hop supply blast radius",
    messages: [
      {
        id: "t1",
        agent: "Scout",
        icon: "🛰",
        color: "#38BDF8",
        ts: "07:13:02",
        text: "Typhoon Haikui-2 detected. Landfall probability 0.80 in 48h near Hsinchu, Taiwan. Port of Keelung closing container operations for 72h.",
        evidence: ["ev_weather_tw", "ev_gdelt_7"],
        isScenario: true,
      },
      {
        id: "t2",
        agent: "Navigator",
        icon: "🧭",
        color: "#06B6D4",
        ts: "07:13:08",
        text: "5-hop blast radius computed: Formosa Semicon → 2 parts (IC-GD-01 Gate-driver IC, IC-CS-04) → 3 SKUs → 11 open orders → Kirin & Tata Motors. Revenue at risk: $1.82M. Stock-out in 9 days.",
        evidence: ["ev_gql_1"],
      },
      {
        id: "t3",
        agent: "Procurer",
        icon: "🤝",
        color: "#22C55E",
        ts: "07:13:22",
        text: "Qualified alternate supplier verified: Penang Micro (Renesas Malaysia). Lead time 6 days, +8% unit cost ($26.78 vs $24.80), air-sea corridor open. Total split premium: $64k.",
        evidence: ["ev_sql_supplier", "ev_rfq_penang"],
      },
      {
        id: "t4",
        agent: "Planner",
        icon: "📅",
        color: "#3B82F6",
        ts: "07:13:35",
        text: "CP-SAT schedule pull-ahead feasible: 2 days of TM-300 production re-sequenced at Pune (PNQ-L1) using existing crib buffer. Only −0.3pp OTIF impact.",
        evidence: ["ev_cpsat_opt1"],
      },
      {
        id: "t5",
        agent: "Oracle",
        icon: "🔮",
        color: "#8B5CF6",
        ts: "07:13:48",
        text: "Kirin Mobility & Tata Motors SLA penalty clauses active ($180k/day late fee). Prioritise SO-1001 and SO-1002 allocation.",
        evidence: ["ev_sla_contract"],
      },
      {
        id: "t6",
        agent: "Ledger",
        icon: "💰",
        color: "#F59E0B",
        ts: "07:14:01",
        text: "Financial trade-off matrix ready: Option A (Penang split-source + Pune pull-ahead) costs $64k and protects $1.82M. Option B (full air charter) costs $142k.",
        evidence: ["ev_ledger_calc"],
      },
      {
        id: "t7",
        agent: "Critic",
        icon: "⚖",
        color: "#9CA3AF",
        ts: "07:14:18",
        text: "Option C (defer & transfer to Nagoya) VETOED — PNQ-L2 and NGO-GRD-01 are at 97% capacity. Options A and B verified with 3/3 citations. Recommending Option A.",
        evidence: ["ev_critic_audit"],
      },
    ],
    criticSummary: "3/3 citations verified · Option C vetoed (capacity limit)",
    options: [
      {
        id: "OPT-A",
        label: "Option A: Split-source + pull-ahead",
        cost: "$64k",
        otif: "−0.3pp",
        recommended: true,
        feasible: true,
        desc: "Penang Micro dual-track PO (500 pcs) + 2-shift pull-ahead at Pune",
      },
      {
        id: "OPT-B",
        label: "Option B: Full air freight charter",
        cost: "$142k",
        otif: "0.0pp",
        recommended: false,
        feasible: true,
        desc: "Dedicated express cargo flight from Kaohsiung hub prior to port closure",
      },
      {
        id: "OPT-C",
        label: "Option C: Defer + cross-plant transfer",
        cost: "$210k",
        otif: "−4.2pp",
        recommended: false,
        feasible: false,
        desc: "Dropped by Critic: Nagoya capacity saturated (97%) & breaches Kirin SLA",
      },
    ],
    dispatchedActions: [
      { id: "act_po_penang", text: "SAP ERP Purchase Order (500x IC-GD-01) dispatched to Penang Micro" },
      { id: "act_reschedule_ngo", text: "MES production schedule shifted +2 days pull-ahead at Pune (PNQ-L1)" },
      { id: "act_notify_kirin", text: "CRM delivery assurance advisory sent to Kirin Mobility & Tata Motors" },
    ],
  },
  bearing_failure_cnc07: {
    key: "bearing_failure_cnc07",
    decisionId: "dec_002",
    badgeLabel: "PNQ-CNC-07 Spindle Bearing Breach",
    title: "PNQ-CNC-07 Outer-Race Bearing Fault & CP-SAT Re-Dispatch",
    severity: "CRITICAL",
    estValueProtected: "$125k",
    triggerTitle: "CNC-07 Spindle Bearing Spalling",
    triggerSubtitle: "RMS vibration 2.82 mm/s (ISO limit 2.5) · P10 RUL 26.5h at Pune Line L1",
    metrics: [
      { label: "Asset at risk", value: "PNQ-CNC-07 (Spindle)", color: "text-red-400" },
      { label: "Failure mode", value: "Outer-race spalling (142 Hz)", color: "text-orange-400" },
      { label: "Remaining life", value: "P10: 26.5h · P50: 34.0h", color: "text-red-400" },
      { label: "Required spare", value: "BRG-6205 (18 in Crib B)", color: "text-emerald-400" },
      { label: "Downtime at risk", value: "$125k (38h seizure)", color: "text-red-400" },
      { label: "Optimal PM slot", value: "Thu 14:00 (3h window)", color: "text-cyan-400" },
    ],
    graphChain: ["PNQ-CNC-07", "BRG-6205", "Job J005 (TM-300)", "SO-1001", "Tata Motors"],
    graphCitation: "[ev:sentinel-fft] FFT envelope + CP-SAT dependency trace",
    messages: [
      {
        id: "b1",
        agent: "Sentinel",
        icon: "🛡️",
        color: "#EF4444",
        ts: "07:02:11",
        text: "Spindle vibration on PNQ-CNC-07 reached 2.82 mm/s RMS (breaching 2.5 mm/s ISO 10816 threshold). BPFO harmonic spike at 142 Hz + Kurtosis 6.42 confirm outer-race bearing spalling. P10 RUL is 26.5 hours.",
        evidence: ["ev_vib_cnc07", "ev_fft_bpfo"],
        isScenario: true,
      },
      {
        id: "b2",
        agent: "Procurer",
        icon: "🤝",
        color: "#22C55E",
        ts: "07:02:19",
        text: "Verified Pune Crib B spare stock: 18 units of SKF BRG-6205 on hand (Bin P-14). Reserved 2 units for immediate spindle overhaul and staged replenishment PO for 20 units.",
        evidence: ["ev_wms_crib_b"],
      },
      {
        id: "b3",
        agent: "Planner",
        icon: "📅",
        color: "#3B82F6",
        ts: "07:02:34",
        text: "Solved 7-day CP-SAT schedule (0.094s): inserted 3-hour PM blackout window on PNQ-CNC-07 (Thu 14:00–17:00) and shifted Job J005 (TM-300 for Tata Motors) onto parallel mill PNQ-CNC-08.",
        evidence: ["ev_cpsat_cnc07"],
      },
      {
        id: "b4",
        agent: "Navigator",
        icon: "🧭",
        color: "#06B6D4",
        ts: "07:02:46",
        text: "Downstream order impact verified: re-routing Job J005 to PNQ-CNC-08 preserves 100% OTIF on SO-1001 (Tata Motors) and SO-1004 (Kirin Auto) with zero customer delay.",
        evidence: ["ev_gql_orders"],
      },
      {
        id: "b5",
        agent: "Ledger",
        icon: "💰",
        color: "#F59E0B",
        ts: "07:02:58",
        text: "Cost-benefit analysis: planned 3h bearing replacement costs $4.2k vs $125k catastrophic spindle seizure + 38h unplanned line outage. Net value protected: $120.8k.",
        evidence: ["ev_ledger_pm"],
      },
      {
        id: "b6",
        agent: "Critic",
        icon: "⚖",
        color: "#9CA3AF",
        ts: "07:03:12",
        text: "Option C (derating CNC-07 to 80% feed rate until Sunday) VETOED — P10 RUL is 26.5h, creating unacceptable risk of mid-cut seizure. Option A verified with mandatory LOTO on isolator Q1.",
        evidence: ["ev_loto_sop14", "ev_critic_pass"],
      },
    ],
    criticSummary: "LOTO Q1 protocol verified · Option C vetoed (safety & P10 RUL breach)",
    options: [
      {
        id: "OPT-A",
        label: "Option A: Thu 14:00 PM Window + Shift J005",
        cost: "$4.2k",
        otif: "0.0pp",
        recommended: true,
        feasible: true,
        desc: "Lock 3h PM blackout on CNC-07, reserve BRG-6205, shift J005 to CNC-08",
      },
      {
        id: "OPT-B",
        label: "Option B: Immediate Mid-Shift Line Stop",
        cost: "$18.5k",
        otif: "−0.4pp",
        recommended: false,
        feasible: true,
        desc: "Abort current batch J001 immediately for unscheduled spindle teardown",
      },
      {
        id: "OPT-C",
        label: "Option C: Derate Spindle to 80% Until Sunday",
        cost: "$125k risk",
        otif: "−3.8pp",
        recommended: false,
        feasible: false,
        desc: "Dropped by Critic: Exceeds P10 RUL (26.5h) & violates ISO safety limits",
      },
    ],
    dispatchedActions: [
      { id: "act_wo_cnc07", text: "CMMS Work Order #WO-9942 locked on PNQ-CNC-07 (Thu 14:00 + LOTO Q1)" },
      { id: "act_spare_brg", text: "WMS Spare Reservation: 2x SKF BRG-6205 staged from Pune Crib B" },
      { id: "act_mes_j005", text: "MES CP-SAT Schedule updated: Job J005 shifted to PNQ-CNC-08" },
    ],
  },
};

const AGENT_COLORS: Record<string, string> = {
  Sentinel: "#EF4444",
  Scout: "#38BDF8",
  Navigator: "#06B6D4",
  Procurer: "#22C55E",
  Planner: "#3B82F6",
  Oracle: "#8B5CF6",
  Ledger: "#F59E0B",
  Critic: "#9CA3AF",
};

function AgentMessage({
  msg,
  visible,
}: {
  msg: WarRoomMessage;
  visible: boolean;
}) {
  const color = AGENT_COLORS[msg.agent] || msg.color || "#38BDF8";
  return (
    <div
      className={cn(
        "flex gap-2.5 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 border"
        style={{
          borderColor: color + "40",
          background: color + "15",
        }}
      >
        {msg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color }}>
            {msg.agent}
          </span>
          <span className="text-[10px] text-[#8B98A9] font-mono">{msg.ts}</span>
          {msg.isScenario && <Badge variant="scenario">TRIGGER</Badge>}
        </div>
        <div className="bg-[#0B0F14] border border-[#243042] rounded-lg px-3 py-2 text-xs text-[#E6EDF3] leading-relaxed">
          {msg.text}
        </div>
        {msg.evidence && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {msg.evidence.map((ev) => (
              <span
                key={ev}
                className="text-[10px] bg-[#1A2230] border border-[#243042] text-[#A78BFA] px-1.5 py-0.5 rounded font-mono"
              >
                [{ev}]
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WarRoomView({ decisionId }: { decisionId?: string }) {
  const { user, activeScenario, setActiveScenario } = useAppStore();

  // Determine active scenario key strictly from Demo Director bar or explicit route decisionId
  const currentScenarioKey: "typhoon_hsinchu" | "bearing_failure_cnc07" | null =
    activeScenario === "bearing_failure_cnc07" || decisionId === "dec_002"
      ? "bearing_failure_cnc07"
      : activeScenario === "typhoon_hsinchu" || decisionId === "dec_001"
      ? "typhoon_hsinchu"
      : null;

  const scenario = currentScenarioKey ? SCENARIO_CONFIGS[currentScenarioKey] : null;

  const [visibleCount, setVisibleCount] = useState(0);
  const [selectedOptId, setSelectedOptId] = useState<string>("OPT-A");
  const [approvedOption, setApprovedOption] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionItem | null>(null);
  const [running, setRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset War Room state whenever the scenario changes in Demo Director or scenario tabs
  useEffect(() => {
    setVisibleCount(0);
    setSelectedOptId("OPT-A");
    setApprovedOption(null);
    setRunning(false);
  }, [currentScenarioKey]);

  useEffect(() => {
    if (!currentScenarioKey || !scenario) return;
    let mounted = true;
    fetchDecisions().then((list) => {
      if (mounted && list?.length) {
        const found = list.find(
          (d) =>
            d.id === scenario.decisionId ||
            d.decision_id === scenario.decisionId ||
            (currentScenarioKey === "bearing_failure_cnc07" && /CNC-07|Bearing/i.test(d.title))
        );
        setDecision(found || list[0]);
      }
    }).catch(() => {});

    fetchBlastRadius({
      event_type: currentScenarioKey === "bearing_failure_cnc07" ? "asset_failure" : "weather",
      entity_id: currentScenarioKey === "bearing_failure_cnc07" ? "PNQ-CNC-07" : "SUP-FORMOSA",
    }).catch(() => {});

    return () => {
      mounted = false;
    };
  }, [currentScenarioKey, scenario]);

  const startWarRoom = () => {
    setRunning(true);
    setVisibleCount(1);
    setApprovedOption(null);
    if (scenario && currentScenarioKey) {
      triggerWarRoomDeliberation(scenario.decisionId, currentScenarioKey).catch(() => {});
    }
  };

  useEffect(() => {
    if (!running || !scenario) return;
    if (visibleCount >= scenario.messages.length) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => {
      setVisibleCount((v) => v + 1);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 950);
    return () => clearTimeout(t);
  }, [running, visibleCount, scenario]);

  const allDone = scenario ? visibleCount >= scenario.messages.length : false;

  const handleApprove = async (optionId: string) => {
    if (!scenario) return;
    const decId = decision?.id || decision?.decision_id || scenario.decisionId;
    setApprovedOption(optionId);
    try {
      await approveDecision(decId, { option_id: optionId, comment: `Approved ${optionId} in War Room` });
    } catch {
      // Handled optimistically
    }
  };

  const handleReject = async () => {
    if (!scenario) return;
    const decId = decision?.id || decision?.decision_id || scenario.decisionId;
    setApprovedOption("rejected");
    try {
      await rejectDecision(decId, { reason: "Postponed by plant manager" });
    } catch {
      // Handled optimistically
    }
  };

  if (!scenario) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Swords className="w-5 h-5 text-emerald-400" />
            <h1 className="text-lg font-bold text-[#E6EDF3]">War Room Negotiation</h1>
            <Badge variant="ok">STANDBY · NOMINAL BASELINE</Badge>
          </div>
          <span className="text-xs text-[#8B98A9] font-mono">
            0 active escalations · Select a scenario in the Demo Director bar to convene agents
          </span>
        </div>

        <Card className="p-8 text-center space-y-5 bg-[#0c1322] border-[#243042]">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-base font-bold text-[#E6EDF3]">
              All Manufacturing & Supply Corridors Operating Nominally
            </h2>
            <p className="text-xs text-[#8B98A9] leading-relaxed">
              No L2 cross-functional War Room deliberation is currently active. Select a disruption scenario from the top <strong>Demo Director</strong> bar to convene the agents.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Overview Banner */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Swords className="w-5 h-5 text-[#EF4444]" />
          <h1 className="text-lg font-bold text-[#E6EDF3]">War Room Negotiation</h1>
          <Badge variant="scenario">L2 AUTONOMY</Badge>
          <Badge variant={scenario.severity === "CRITICAL" ? "critical" : "high"}>
            {scenario.badgeLabel}
          </Badge>
        </div>

        <span className="text-xs text-[#8B98A9] font-mono">
          Severity: {scenario.severity} · Est. Value Protected: <strong className="text-emerald-400">{scenario.estValueProtected}</strong>
        </span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Situation & Blast Radius panel */}
        <Card className="col-span-12 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-warning" /> Disruption Impact
            </CardTitle>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              Value: {scenario.estValueProtected}
            </span>
          </CardHeader>
          <div className="space-y-3 text-xs">
            <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#243042] space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[#8B98A9] text-[10px] uppercase font-mono">Trigger Disruption</p>
                <Badge variant="scenario">LIVE SCENARIO</Badge>
              </div>
              <p className="text-[#E6EDF3] font-semibold">
                {scenario.triggerTitle}
              </p>
              <p className="text-[#8B98A9] text-[11px] leading-relaxed">{scenario.triggerSubtitle}</p>
            </div>

            <div className="space-y-1.5">
              {scenario.metrics.map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8B98A9]">{label}</span>
                  <span className={cn("font-medium font-mono text-right", color)}>{value}</span>
                </div>
              ))}
            </div>

            {/* Blast radius node graph */}
            <div className="bg-[#0B0F14] rounded-lg p-2.5 border border-[#243042] space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] text-[#8B98A9]">
                <Network className="w-3 h-3 text-primary" />
                <span>5-Hop Dependency Chain (/v1/graph/blast-radius)</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#E6EDF3] flex-wrap">
                {scenario.graphChain.map((node, idx) => (
                  <span key={node} className="flex items-center gap-1">
                    {idx > 0 && <ArrowRight className="w-2.5 h-2.5 text-[#8B98A9]" />}
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded font-mono",
                        idx === scenario.graphChain.length - 1
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-[#1A2230] border border-[#243042]"
                      )}
                    >
                      {node}
                    </span>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-[#A78BFA] font-mono">{scenario.graphCitation}</p>
            </div>

            {!running ? (
              <Button variant="primary" size="sm" className="w-full cursor-pointer" onClick={startWarRoom}>
                <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                {visibleCount > 0 ? "Replay Agent Deliberation" : "Start War Room Deliberation"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#8B98A9] bg-base-300 p-2 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-ping" />
                Agents negotiating trade-offs ({visibleCount}/{scenario.messages.length})…
              </div>
            )}
          </div>
        </Card>

        {/* Agent deliberation */}
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader>
            <CardTitle>Cross-Agent Deliberation ({visibleCount}/{scenario.messages.length} turns)</CardTitle>
            {running ? (
              <div className="flex gap-1 items-center">
                <span className="text-[10px] text-primary font-mono mr-1">Live Debate</span>
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce delay-200" />
              </div>
            ) : allDone ? (
              <span className="text-[10px] font-mono text-emerald-400">Consensus Reached</span>
            ) : (
              <span className="text-[10px] font-mono text-amber-400">Awaiting Convene</span>
            )}
          </CardHeader>

          {visibleCount === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6 space-y-2.5 border border-dashed border-[#243042] rounded-lg bg-[#0B0F14]/60">
              <Swords className="w-7 h-7 text-primary/60" />
              <div className="space-y-1 max-w-xs">
                <p className="text-xs font-semibold text-[#E6EDF3]">
                  Agents Ready to Convene
                </p>
                <p className="text-[11px] text-[#8B98A9] leading-relaxed">
                  Click <strong>&ldquo;Start War Room Deliberation&rdquo;</strong> in the Disruption Impact panel to stream the multi-agent negotiation.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
              {scenario.messages.slice(0, visibleCount).map((msg) => (
                <AgentMessage key={msg.id} msg={msg} visible={true} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </Card>

        {/* Decision Brief & Option Comparison Matrix */}
        <Card className="col-span-12 lg:col-span-4" glow={allDone}>
          <CardHeader>
            <CardTitle>Trade-off Comparison Matrix</CardTitle>
            {allDone ? (
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-success" />
                <Badge variant="ok">Critic: PASS</Badge>
              </div>
            ) : (
              <Badge variant="default">Pending Critic Audit</Badge>
            )}
          </CardHeader>

          {!allDone ? (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6 space-y-3 border border-dashed border-[#243042] rounded-lg bg-[#0B0F14]/60">
              <ShieldCheck className="w-7 h-7 text-[#8B98A9]/50" />
              <div className="space-y-1 max-w-xs">
                <p className="text-xs font-semibold text-[#E6EDF3]">
                  {running ? "Synthesizing & Auditing Options…" : "Awaiting Agent Deliberation"}
                </p>
                <p className="text-[11px] text-[#8B98A9] leading-relaxed">
                  {running
                    ? `Agents are evaluating cost, OTIF, and safety constraints (${visibleCount}/${scenario.messages.length} turns)…`
                    : "Trade-off options and Critic verification gate will unlock once the War Room deliberation completes."}
                </p>
              </div>
              {running && (
                <button
                  type="button"
                  onClick={() => {
                    setVisibleCount(scenario.messages.length);
                    setRunning(false);
                  }}
                  className="text-[10px] text-primary hover:underline font-mono cursor-pointer"
                >
                  Skip to Consensus →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {scenario.options.map((opt) => {
                const isSelected = selectedOptId === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      if (opt.feasible && !approvedOption) {
                        setSelectedOptId(opt.id);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-lg border text-xs transition-all",
                      !opt.feasible
                        ? "opacity-45 border-[#243042] bg-[#0B0F14] cursor-not-allowed"
                        : isSelected
                        ? "border-[#4F8CFF] bg-[#4F8CFF]/10 shadow-sm cursor-pointer"
                        : "border-[#243042] bg-[#0B0F14] hover:border-[#4F8CFF]/40 cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {opt.recommended && <span className="text-yellow-400">★</span>}
                      <span className={cn("font-semibold", isSelected || opt.recommended ? "text-[#E6EDF3]" : "text-[#8B98A9]")}>
                        {opt.label}
                      </span>
                      {!opt.feasible && <Badge variant="critical">Dropped</Badge>}
                      {opt.recommended && <Badge variant="ok">Recommended</Badge>}
                    </div>
                    <p className="text-[11px] text-[#8B98A9] mb-2">{opt.desc}</p>
                    <div className="flex gap-4 font-mono text-[11px]">
                      <span className="text-[#8B98A9]">
                        Cost: <span className="text-[#E6EDF3]">{opt.cost}</span>
                      </span>
                      <span className="text-[#8B98A9]">
                        OTIF Impact: <span className="text-[#E6EDF3]">{opt.otif}</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Action buttons */}
              {!approvedOption ? (
                <div className="space-y-2 pt-1 border-t border-[#243042]">
                  <p className="text-[11px] text-[#8B98A9]">
                    Critic Gate: <span className="text-[#E6EDF3]">{scenario.criticSummary}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      className="flex-1 cursor-pointer"
                      onClick={() => handleApprove(selectedOptId)}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Authorize {selectedOptId}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="cursor-pointer"
                      onClick={handleReject}
                      title="Reject proposal"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
            ) : approvedOption !== "rejected" ? (
              <div className="space-y-2.5 pt-2 border-t border-[#243042]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" /> {approvedOption} Authorized by {user?.name || "Sarah Chen"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setApprovedOption(null)}
                    className="text-[10px] text-[#8B98A9] hover:text-white underline cursor-pointer"
                  >
                    Undo
                  </button>
                </div>
                <div className="space-y-1.5 text-[11px] bg-[#0B0F14] p-3 rounded-lg border border-green-500/20">
                  <p className="text-[10px] uppercase tracking-wider text-[#8B98A9] font-semibold mb-1 font-mono">
                    Dispatched Actions (/v1/decisions/{scenario.decisionId}/approve)
                  </p>
                  {scenario.dispatchedActions.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 text-green-400">
                      <span>✓</span>
                      <span>{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
                <span>Decision marked as Rejected with audit trail.</span>
                <button
                  type="button"
                  onClick={() => setApprovedOption(null)}
                  className="text-[10px] text-[#8B98A9] hover:text-white underline cursor-pointer"
                >
                  Undo
                </button>
              </div>
            )}
          </div>
          )}
        </Card>
      </div>
    </div>
  );
}
