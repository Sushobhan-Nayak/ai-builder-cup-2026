"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Swords, Network, ShieldCheck, ArrowRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchDecisions,
  fetchBlastRadius,
  approveDecision,
  rejectDecision,
  type DecisionItem,
} from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

const WAR_ROOM_MESSAGES = [
  { id: "m1", agent: "Scout", icon: "🛰", color: "#38BDF8", ts: "07:13:02", text: "Typhoon Haikui-2 detected. Landfall probability 0.80 in 48 h near Hsinchu, Taiwan. Source: Weather API alert + GDELT.", evidence: ["ev_feed_3", "ev_feed_7"], isScenario: true },
  { id: "m2", agent: "Navigator", icon: "🧭", color: "#06B6D4", ts: "07:13:08", text: "Blast radius computed: Formosa Semicon → 2 parts (gate-driver IC, current-sensor IC) → 3 SKUs → 11 open orders → 2 customers. Revenue at risk: $1.82M. Stock-out in 9 days.", evidence: ["ev_gql_1"] },
  { id: "m3", agent: "Procurer", icon: "🤝", color: "#22C55E", ts: "07:13:22", text: "Alternate supplier found: Penang Micro (qualified, share_pct=0). Lead time 6 days, +8% unit cost, air freight available. Estimated premium: $64k.", evidence: ["ev_sql_4", "ev_doc_2"] },
  { id: "m4", agent: "Planner", icon: "📅", color: "#3B82F6", ts: "07:13:35", text: "Pull-ahead feasible: 2 days of production re-sequenced at PNQ. 0.3 pp OTIF impact. 2 shifts OT required.", evidence: ["ev_opt_1"] },
  { id: "m5", agent: "Oracle", icon: "🔮", color: "#8B5CF6", ts: "07:13:48", text: "Kirin Mobility orders are critical — penalty clause active. Prioritise CUST-KIRIN in all options.", evidence: ["ev_sql_8"] },
  { id: "m6", agent: "Ledger", icon: "💰", color: "#F59E0B", ts: "07:14:01", text: "Impact table computed. Option A: air freight only, $142k cost, OTIF −0.0pp. Option B: split-source + pull-ahead, $64k cost, OTIF −0.3pp. Option C: defer + expedite, $210k cost.", evidence: ["ev_sql_9"] },
  { id: "m7", agent: "Critic", icon: "⚖", color: "#9CA3AF", ts: "07:14:18", text: "Option C infeasible — PNQ-L2 at 97% capacity, cannot absorb NGO split. Options A and B verified. All claims have evidence. Recommending Option B.", evidence: ["ev_opt_2"] },
];

const AGENT_COLORS: Record<string, string> = {
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
  msg: (typeof WAR_ROOM_MESSAGES)[0];
  visible: boolean;
}) {
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
          borderColor: AGENT_COLORS[msg.agent] + "40",
          background: AGENT_COLORS[msg.agent] + "15",
        }}
      >
        {msg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color: AGENT_COLORS[msg.agent] }}>
            {msg.agent}
          </span>
          <span className="text-[10px] text-[#8B98A9]">{msg.ts}</span>
          {msg.isScenario && <Badge variant="scenario">SCENARIO</Badge>}
        </div>
        <div className="bg-[#0B0F14] border border-[#243042] rounded-lg px-3 py-2 text-xs text-[#E6EDF3] leading-relaxed">
          {msg.text}
        </div>
        {msg.evidence && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {msg.evidence.map((ev) => (
              <span
                key={ev}
                className="text-[10px] bg-[#1A2230] border border-[#243042] text-[#A78BFA] px-1.5 py-0.5 rounded cursor-pointer hover:border-[#A78BFA] transition-colors"
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
  const { user } = useAppStore();
  const [visibleCount, setVisibleCount] = useState(0);
  const [approvedOption, setApprovedOption] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionItem | null>(null);
  const [blastRadius, setBlastRadius] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    // 1. Fetch decisions from /v1/decisions
    fetchDecisions().then((list) => {
      if (mounted && list?.length) {
        const found = decisionId
          ? list.find((d) => d.id === decisionId || d.decision_id === decisionId)
          : list[0];
        setDecision(found || list[0]);
      }
    });

    // 2. Fetch blast radius from /v1/graph/blast-radius
    fetchBlastRadius({ event_type: "weather", entity_id: "SUP-FORMOSA" }).then((data) => {
      if (mounted) {
        setBlastRadius(data);
      }
    });

    return () => {
      mounted = false;
    };
  }, [decisionId]);

  const startWarRoom = () => {
    setRunning(true);
    setVisibleCount(0);
    setApprovedOption(null);
  };

  useEffect(() => {
    if (!running) return;
    if (visibleCount >= WAR_ROOM_MESSAGES.length) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => {
      setVisibleCount((v) => v + 1);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 1400);
    return () => clearTimeout(t);
  }, [running, visibleCount]);

  const allDone = visibleCount >= WAR_ROOM_MESSAGES.length;

  const handleApprove = async (optionId: string) => {
    const decId = decision?.id || decision?.decision_id || "dec_001";
    try {
      await approveDecision(decId, { option_id: optionId, comment: "Approved in War Room" });
      setApprovedOption(optionId);
      setActionStatus({
        act_po_penang: true,
        act_reschedule_ngo: true,
        act_notify_kirin: true,
      });
    } catch (err) {
      console.error("Approve decision failed:", err);
    }
  };

  const handleReject = async () => {
    const decId = decision?.id || decision?.decision_id || "dec_001";
    try {
      await rejectDecision(decId, { reason: "Postponed by plant manager" });
      setApprovedOption("rejected");
    } catch (err) {
      console.error("Reject decision failed:", err);
    }
  };

  const criticVerdict = decision?.critic_verdict || {
    verdict: "PASS",
    audited_claims: 3,
    issues: [],
    dropped_options: ["OPT-C"],
  };

  return (
    <div className="p-4 space-y-4">
      {/* Overview Banner */}
      <div className="flex items-center gap-3">
        <Swords className="w-5 h-5 text-[#EF4444]" />
        <h1 className="text-lg font-bold text-[#E6EDF3]">War Room Negotiation</h1>
        <Badge variant="scenario">L2 AUTONOMY</Badge>
        <Badge variant="high">
          {decision?.title || "Typhoon Haikui-2 → Formosa Semicon"}
        </Badge>
        <span className="text-xs text-[#8B98A9] ml-auto font-mono">
          Severity: HIGH · Est. Value: ${((decision?.impact?.usd_benefit || 1820000) / 1000).toFixed(0)}k
        </span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Situation & Blast Radius panel - Connected to /v1/graph/blast-radius */}
        <Card className="col-span-12 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-warning" /> Disruption Impact
            </CardTitle>
          </CardHeader>
          <div className="space-y-3 text-xs">
            <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#243042] space-y-1.5">
              <p className="text-[#8B98A9]">Trigger Disruption</p>
              <p className="text-[#E6EDF3] font-medium flex items-center gap-2">
                Typhoon Haikui-2 <Badge variant="scenario">SCENARIO</Badge>
              </p>
              <p className="text-[#8B98A9] text-[11px]">Landfall p=0.80 in 48h near Hsinchu, Taiwan</p>
            </div>

            <div className="space-y-1.5">
              {[
                { label: "Supplier at risk", value: blastRadius?.supplier_id || "Formosa Semicon", color: "text-red-400" },
                { label: "Parts affected", value: "2 (gate-driver IC, current-sensor IC)", color: "text-orange-400" },
                { label: "SKUs affected", value: "3", color: "text-yellow-400" },
                { label: "Open orders", value: blastRadius?.affected_orders_count ? `${blastRadius.affected_orders_count}` : "11", color: "text-[#E6EDF3]" },
                {
                  label: "Revenue at risk",
                  value: `$${(((blastRadius?.revenue_at_risk_usd ?? blastRadius?.total_revenue_at_risk_usd) || 793500) / 1000).toFixed(0)}k`,
                  color: "text-red-400",
                },
                { label: "Stock-out in", value: "9 days", color: "text-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8B98A9]">{label}</span>
                  <span className={cn("font-medium font-mono", color)}>{value}</span>
                </div>
              ))}
            </div>

            {/* Blast radius node graph */}
            <div className="bg-[#0B0F14] rounded-lg p-2.5 border border-[#243042] space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] text-[#8B98A9]">
                <Network className="w-3 h-3 text-primary" />
                <span>Graph Blast Radius (/v1/graph/blast-radius)</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#E6EDF3] flex-wrap">
                <span className="bg-[#1A2230] px-1.5 py-0.5 rounded border border-[#243042]">{blastRadius?.supplier_id || "Formosa"}</span>
                <ArrowRight className="w-2.5 h-2.5 text-[#8B98A9]" />
                <span className="bg-[#1A2230] px-1.5 py-0.5 rounded border border-[#243042]">IC-GD-01</span>
                <ArrowRight className="w-2.5 h-2.5 text-[#8B98A9]" />
                <span className="bg-[#1A2230] px-1.5 py-0.5 rounded border border-[#243042]">TM-300</span>
                <ArrowRight className="w-2.5 h-2.5 text-[#8B98A9]" />
                <span className="bg-[#1A2230] px-1.5 py-0.5 rounded border border-[#243042]">SO-1001</span>
                <ArrowRight className="w-2.5 h-2.5 text-[#8B98A9]" />
                <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded">Tata & Toyota</span>
              </div>
              <p className="text-[10px] text-[#A78BFA]">[ev:gql-1] Spanner Graph 5-hop blast radius</p>
            </div>

            {!running && visibleCount === 0 && (
              <Button variant="primary" size="sm" className="w-full" onClick={startWarRoom}>
                ▶ Start War Room Deliberation
              </Button>
            )}
            {running && (
              <div className="flex items-center gap-2 text-xs text-[#8B98A9] bg-base-300 p-2 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-ping" />
                Agents negotiating options…
              </div>
            )}
          </div>
        </Card>

        {/* Agent deliberation */}
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader>
            <CardTitle>Cross-Agent Deliberation</CardTitle>
            {running && (
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce delay-200" />
              </div>
            )}
          </CardHeader>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-260px)]">
            {WAR_ROOM_MESSAGES.map((msg, i) => (
              <AgentMessage key={msg.id} msg={msg} visible={visibleCount === 0 ? true : i < visibleCount} />
            ))}
            <div ref={bottomRef} />
          </div>
        </Card>

        {/* Decision Brief & Option Comparison Matrix */}
        <Card className="col-span-12 lg:col-span-4" glow={allDone || visibleCount === 0}>
          <CardHeader>
            <CardTitle>Trade-off Comparison Matrix</CardTitle>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-success" />
              <Badge variant="ok">Critic: {criticVerdict.verdict}</Badge>
            </div>
          </CardHeader>

          <div className="space-y-3">
            {((decision?.options && decision.options.length > 0)
              ? decision.options.map((opt: any, idx: number) => ({
                  id: opt.option_id || `OPT-${idx}`,
                  label: opt.title || `Option ${opt.option_id}`,
                  cost: opt.est_cost_usd ? `$${(opt.est_cost_usd / 1000).toFixed(0)}k` : "$64k",
                  otif: opt.downtime_hours_avoided ? `+${opt.downtime_hours_avoided}h` : "−0.3pp",
                  recommended: idx === 0 || opt.option_id === "OPT-A" || opt.recommended,
                  feasible: !criticVerdict.dropped_options?.includes(opt.option_id),
                  desc: opt.description || "Cross-functional synthesized plan",
                }))
              : [
                  {
                    id: "OPT-A",
                    label: "Option A: Split-source + pull-ahead",
                    cost: "$64k",
                    otif: "−0.3pp",
                    recommended: true,
                    feasible: true,
                    desc: "Penang Micro dual-track PO + 2-shift advance at Pune",
                  },
                  {
                    id: "OPT-B",
                    label: "Option B: Air freight charter",
                    cost: "$142k",
                    otif: "0.0pp",
                    recommended: false,
                    feasible: true,
                    desc: "Express flight from Kaohsiung hub",
                  },
                  {
                    id: "OPT-C",
                    label: "Option C: Defer + expedite",
                    cost: "$210k",
                    otif: "−1.2pp",
                    recommended: false,
                    feasible: false,
                    desc: "Dropped by Critic: Nagoya capacity saturated (97%)",
                  },
                ]
            ).map((opt) => (
              <div
                key={opt.id}
                className={cn(
                  "p-3 rounded-lg border text-xs transition-all",
                  !opt.feasible
                    ? "opacity-40 border-[#243042] bg-[#0B0F14]"
                    : opt.recommended
                    ? "border-[#4F8CFF]/50 bg-[#4F8CFF]/5 shadow-sm"
                    : "border-[#243042] bg-[#0B0F14]"
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {opt.recommended && <span className="text-yellow-400">★</span>}
                  <span className={cn("font-semibold", opt.recommended ? "text-[#E6EDF3]" : "text-[#8B98A9]")}>
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
                    OTIF: <span className="text-[#E6EDF3]">{opt.otif}</span>
                  </span>
                </div>
              </div>
            ))}

            {/* Action buttons */}
            {!approvedOption ? (
              <div className="space-y-2 pt-1 border-t border-[#243042]">
                <p className="text-[11px] text-[#8B98A9]">
                  Audited Claims: <span className="text-[#E6EDF3]">3/3 citations verified</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleApprove("OPT-A")}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Authorize Option A
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleReject}
                    title="Reject proposal"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : approvedOption !== "rejected" ? (
              <div className="space-y-2.5 pt-2 border-t border-[#243042]">
                <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> {approvedOption} Authorized by {user?.name || "Sarah Chen"}
                </div>
                <div className="space-y-1.5 text-[11px] bg-[#0B0F14] p-3 rounded-lg border border-green-500/20">
                  <p className="text-[10px] uppercase tracking-wider text-[#8B98A9] font-semibold mb-1">
                    Dispatched Actions (/v1/decisions/{decision?.id || "dec_001"}/approve)
                  </p>
                  {[
                    { id: "act_po_penang", text: "ERP Purchase Order to Penang Micro created", done: true },
                    { id: "act_reschedule_ngo", text: "MES production schedule shifted +2 days at Pune", done: true },
                    { id: "act_notify_kirin", text: "CRM notification drafted for Kirin Mobility", done: true },
                  ].map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 text-green-400">
                      <span>✓</span>
                      <span>{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                Decision marked as Rejected with audit trail.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
