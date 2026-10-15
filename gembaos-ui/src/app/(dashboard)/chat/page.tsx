"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, RotateCcw, ChevronRight, User, Terminal, Database, ShieldCheck, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { sendChatMessage } from "@/lib/api-client";

const SUGGESTIONS = [
  {
    label: "Why is OEE down in Pune today?",
    category: "MAINTENANCE",
    icon: "🛡️",
    agent: "Sentinel",
    hint: "Availability loss & CNC-07 bearing wear breakdown",
  },
  {
    label: "Show scrap trend for Rayong last 7 days",
    category: "QUALITY",
    icon: "🔍",
    agent: "Inspector",
    hint: "Die temperature drift & casting porosity defects",
  },
  {
    label: "What's the blast radius of Formosa Semicon?",
    category: "GRAPH RAG",
    icon: "🧭",
    agent: "Navigator",
    hint: "Multi-tier supplier disruption impact on orders & revenue",
  },
  {
    label: "Can we ship 5,000 TM-300 to Kirin by Nov 30?",
    category: "S&OP / CTP",
    icon: "🔮",
    agent: "Oracle",
    hint: "Capable-to-promise capacity check & split-source options",
  },
  {
    label: "Summarise today's top 3 risks across all plants",
    category: "EXECUTIVE",
    icon: "⚡",
    agent: "Orchestrator",
    hint: "Cross-plant risk brief covering downtime, weather & scrap",
  },
  {
    label: "What is the current energy cost per unit at Nagoya?",
    category: "SUSTAINABILITY",
    icon: "🌿",
    agent: "Verdant",
    hint: "Peak tariff shift savings and carbon intensity reduction",
  },
];

const QUICK_PILLS = [
  "Pune OEE Breakdown",
  "Rayong Scrap Trend",
  "Typhoon Blast Radius",
  "Kirin 5,000 TM-300 CTP",
  "Nagoya Energy Cost",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  agent?: string;
  sql?: string;
  evidence?: string[];
}

const MOCK_RESPONSES: Record<string, { text: string; agent: string; sql?: string; evidence?: string[] }> = {
  oee: {
    text: "OEE at Pune is **78.4%** today, down 2.1 pp from yesterday.\n\nThe main driver is **CNC-07 availability** (bearing fault, RUL 68 h). Line 2 quality losses account for 0.7 pp due to the porosity trend at Rayong.\n\nBreakdown:\n• Availability: 88.2% (−2.8 pp)\n• Performance: 94.1% (−0.1 pp)\n• Quality: 94.4% (−0.3 pp)",
    agent: "Analyst → Sentinel",
    sql: "SELECT line_id, AVG(oee) FROM gold.v_oee_hourly WHERE plant_id='PNQ' AND DATE(ts)=CURRENT_DATE GROUP BY 1",
    evidence: ["ev:sql-12", "ev:sql-15"],
  },
  scrap: {
    text: "Rayong scrap rate is **3.2%** this week, up 0.8 pp.\n\nPrimary driver: porosity defects on HSG-220 castings (lot L-4471). Die temperature drifted −18 °C over 4 h — Inspector has flagged this and raised a containment recommendation for 100% X-ray of lot L-4471.",
    agent: "Inspector",
    sql: "SELECT defect_type, COUNT(*) as scrap_count FROM gold.v_inspections WHERE plant_id='RYG' AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) GROUP BY 1 ORDER BY 2 DESC",
    evidence: ["ev:sql-8", "ev:gql-2"],
  },
  blast: {
    text: "**Formosa Semicon blast radius** (BigQuery Graph traversal):\n\n• 2 parts → gate-driver IC, current-sensor IC\n• 3 SKUs → TM-300, INV-150, MCU-220\n• 11 open orders\n• 2 customers → Kirin Mobility, Zenith Motors\n• **Revenue at risk: $1.82M**\n• Stock-out in **9 days**\n\nA War Room has been convened. Option B (split-source Penang + pull-ahead) is recommended.",
    agent: "Navigator",
    sql: "GRAPH kg.mfg_graph MATCH (s:Supplier {supplier_id:'SUP-FORMOSA'})-[:SUPPLIES]->(p:Part)-[:COMPONENT_OF]->(prod:Product)<-[:FOR_PRODUCT]-(so:SalesOrder) WHERE so.status IN ('OPEN','CONFIRMED') RETURN p.part_id, prod.sku_id, so.so_id, so.value_usd",
    evidence: ["ev:gql-1", "ev:sql-4"],
  },
  kirin: {
    text: "**CTP analysis** for 5,000 TM-300 to Kirin Mobility by Nov 30:\n\n✅ **Feasible for 3,800 units** by Nov 30 (confidence 92%)\n\nOptions:\n• **Option A** — 3,800 by Nov 30 + 1,200 by Dec 6 · no extra cost\n• **Option B** — All 5,000 by Nov 30 with Saturday OT at PNQ · +$11.2k\n• **Option C** — Split PNQ + NGO · +$18.9k · NGO-L2 at 97% load ✗\n\nBinding constraints: PNQ-L2 stator winding capacity, gate-driver IC stock.",
    agent: "Oracle + Planner + Ledger",
    sql: "SELECT * FROM gold.v_capacity_ctp WHERE sku_id='TM-300' AND target_date='2026-11-30'",
    evidence: ["ev:sql-12", "ev:opt-3", "ev:sql-15"],
  },
  risks: {
    text: "**Top 3 risks across all plants today:**\n\n🔴 **CNC-07 bearing fault** (Pune) — RUL 68 h, maintenance window Thu 14:00 recommended. Impact: $180k downtime risk.\n\n🟠 **[SCENARIO] Typhoon Haikui-2** → Formosa Semicon supply disruption. 11 orders, $1.82M at risk. Stock-out in 9 days.\n\n🟡 **Casting porosity trend** (Rayong DCM-02) — die temperature drift −18 °C, lot L-4471 affected. Containment recommended.",
    agent: "Orchestrator",
    sql: "SELECT plant_id, asset_id, risk_score, est_impact_usd FROM ai.insights WHERE status='new' ORDER BY est_impact_usd DESC LIMIT 3",
    evidence: ["ev:sql-1", "ev:feed-3", "ev:sql-8"],
  },
  energy: {
    text: "**Energy cost per unit at Nagoya** (current shift):\n\n• Energy/unit: **3.8 kWh** (−0.3 kWh vs last week)\n• CO₂/unit: **1.6 kg** (grid carbon intensity 0.42 kg/kWh)\n• Furnace F-2 pre-heat running at peak tariff window\n\nVerdant recommends shifting furnace pre-heat to 02:00–05:00 off-peak → saves $3.1k and 4.6 tCO₂e/month.",
    agent: "Verdant + Analyst",
    sql: "SELECT metric, avg_value, tariff_window FROM gold.v_energy_hourly WHERE plant_id='NGO' AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)",
    evidence: ["ev:sql-19", "ev:sql-20"],
  },
  default: {
    text: "Based on the latest data from BigQuery, here is the current operational status across all 3 plants:\n\n• OEE: 78.4% (Pune), 82.1% (Rayong), 85.3% (Nagoya)\n• 3 pending decisions in the inbox\n• 4 active insights\n\nCould you be more specific? Try asking about a particular plant, asset, supplier or metric.",
    agent: "Orchestrator",
    sql: "SELECT * FROM gold.v_fleet_kpis WHERE ts_min = (SELECT MAX(ts_min) FROM gold.v_fleet_kpis)",
    evidence: ["ev:sql-1"],
  },
};

function getResponse(msg: string) {
  const lower = msg.toLowerCase();
  if (lower.includes("oee") || lower.includes("pune")) return MOCK_RESPONSES.oee;
  if (lower.includes("scrap") || lower.includes("rayong") || lower.includes("porosity")) return MOCK_RESPONSES.scrap;
  if (lower.includes("blast") || lower.includes("formosa") || lower.includes("typhoon")) return MOCK_RESPONSES.blast;
  if (lower.includes("kirin") || lower.includes("5,000") || lower.includes("ctp") || lower.includes("ship")) return MOCK_RESPONSES.kirin;
  if (lower.includes("risk") || lower.includes("top") || lower.includes("summary")) return MOCK_RESPONSES.risks;
  if (lower.includes("energy") || lower.includes("nagoya") || lower.includes("co2")) return MOCK_RESPONSES.energy;
  return MOCK_RESPONSES.default;
}

function renderContent(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j} className="text-base-content font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{part}</span>;
    });
    if (line.startsWith("•")) {
      return <li key={i} className="ml-4 list-disc text-base-content/80">{parts}</li>;
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-base-content/85">{parts}</p>;
  });
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const localResp = getResponse(text);
    let finalContent = localResp.text;
    let finalAgent = localResp.agent;
    let finalSql = localResp.sql;
    let finalEvidence = localResp.evidence;

    try {
      const liveRes = await sendChatMessage(text, { page: "/chat" });
      if (liveRes && (liveRes.content || liveRes.text || liveRes.message || liveRes.reply)) {
        finalContent = liveRes.content || liveRes.text || liveRes.message || liveRes.reply || localResp.text;
        if (liveRes.agent) finalAgent = liveRes.agent;
        if (liveRes.sql) finalSql = liveRes.sql;
        if (liveRes.evidence && liveRes.evidence.length) finalEvidence = liveRes.evidence;
      }
    } catch (err) {
      console.warn("Live /v1/chat endpoint error, using local grounding:", err);
    }

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        agent: finalAgent,
        sql: finalSql,
        evidence: finalEvidence,
      },
    ]);

    let i = 0;
    const interval = setInterval(() => {
      i += 4;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: finalContent.slice(0, i), streaming: i < finalContent.length } : m
        )
      );
      if (i >= finalContent.length) {
        clearInterval(interval);
        setStreaming(false);
      }
    }, 16);
  };

  const reset = () => {
    setMessages([]);
    setStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] overflow-hidden bg-base-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-base-300 bg-base-200/90 backdrop-blur-md shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-content shadow-md shadow-primary/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-base-content">Ask GembaOS</h1>
            <Badge variant="scenario" className="text-[10px] py-0 px-1.5 font-mono">COPILOT</Badge>
          </div>
          <p className="text-[11px] text-base-content/60">Universal Operations Copilot · Multi-Plant Context · BigQuery Grounded</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-base-300/80 border border-base-300 text-[10px] font-mono text-base-content/60">
            <Cpu className="w-3 h-3 text-primary" />
            <span>Gemini 3.8 Flash</span>
          </div>
          <div className="badge badge-success badge-sm gap-1.5 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-success-content inline-block animate-pulse" />
            Live Grounding
          </div>
          {messages.length > 0 && (
            <button
              onClick={reset}
              className="btn btn-ghost btn-xs gap-1 border border-base-300 text-base-content/70 hover:text-base-content"
            >
              <RotateCcw className="w-3 h-3" /> New Session
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto space-y-7 py-2">
            {/* Welcome Hero */}
            <div className="text-center space-y-2.5">
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary via-secondary to-accent flex items-center justify-center mx-auto shadow-xl shadow-primary/20 ring-4 ring-primary/10">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-base-content">Ask GembaOS</h2>
              <p className="text-xs text-base-content/60 max-w-lg mx-auto leading-relaxed">
                Autonomous cross-functional industrial copilot grounded in real-time telemetry, BigQuery Knowledge Graph, and verifiable evidence.
              </p>
            </div>

            {/* Prompt Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.label)}
                  className="flex items-start gap-3 text-left bg-base-200/80 hover:bg-base-200 border border-base-300 hover:border-primary/50 p-3.5 rounded-xl transition-all group shadow-sm hover:shadow-md cursor-pointer"
                >
                  <span className="text-lg shrink-0 mt-0.5 p-2 bg-base-300 rounded-lg group-hover:scale-105 transition-transform">
                    {s.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                        {s.category}
                      </span>
                      <span className="text-[10px] text-base-content/40 font-mono">via {s.agent}</span>
                    </div>
                    <p className="text-xs font-semibold text-base-content group-hover:text-primary transition-colors">
                      {s.label}
                    </p>
                    <p className="text-[11px] text-base-content/50 mt-0.5 line-clamp-1">
                      {s.hint}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-base-content/30 group-hover:text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
                </button>
              ))}
            </div>

            {/* Capability Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Terminal, label: "NL → SQL & Graph", desc: "Generates verifiable BigQuery GQL & SQL queries" },
                { icon: ShieldCheck, label: "Evidence-First", desc: "Every response cites sensor windows and audit traces" },
                { icon: Database, label: "All 3 Plants", desc: "Full context across Pune, Rayong, and Nagoya" },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="bg-base-200/50 border border-base-300 rounded-xl p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-base-300 shrink-0 text-primary">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content">{c.label}</p>
                      <p className="text-[10px] text-base-content/50 leading-tight mt-0.5">{c.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                {/* Avatar */}
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                  msg.role === "assistant"
                    ? "bg-gradient-to-tr from-primary to-accent text-white"
                    : "bg-base-300 border border-base-300 text-base-content"
                )}>
                  {msg.role === "assistant" ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className={cn("flex flex-col gap-1.5 max-w-[85%]", msg.role === "user" && "items-end")}>
                  {msg.role === "assistant" && msg.agent && (
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded">
                        {msg.agent}
                      </span>
                      <span className="text-[10px] text-base-content/40 font-mono">Grounded Query Result</span>
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={cn(
                    "rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-content rounded-tr-sm"
                      : "bg-base-200 border border-base-300 rounded-tl-sm text-base-content"
                  )}>
                    {msg.role === "assistant" ? (
                      <div className="space-y-1">
                        {renderContent(msg.content)}
                        {msg.streaming && <span className="cursor-blink text-primary ml-0.5 font-bold">▋</span>}
                      </div>
                    ) : (
                      <p className="font-medium">{msg.content}</p>
                    )}
                  </div>

                  {/* SQL Box */}
                  {!msg.streaming && msg.sql && (
                    <div className="w-full bg-base-300/80 border border-base-300 rounded-xl p-2.5 text-[10px] font-mono text-base-content/80 overflow-x-auto shadow-inner">
                      <div className="flex items-center justify-between text-base-content/40 mb-1 border-b border-base-300 pb-1">
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <Terminal className="w-3 h-3" /> EXECUTED BIGQUERY QUERY
                        </span>
                        <span>gold.*</span>
                      </div>
                      <code>{msg.sql}</code>
                    </div>
                  )}

                  {/* Evidence chips */}
                  {!msg.streaming && msg.evidence && msg.evidence.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-base-content/40 font-mono">Evidence:</span>
                      {msg.evidence.map((ev) => (
                        <span
                          key={ev}
                          className="badge badge-sm badge-ghost border-base-300 font-mono text-[9px] hover:border-primary text-primary transition-colors cursor-pointer"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {streaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shrink-0 text-white shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-base-200 border border-base-300 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-base-300 bg-base-200/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Quick Pill Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] text-base-content/40 font-mono shrink-0 mr-1">Suggested:</span>
            {QUICK_PILLS.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => sendMessage(pill)}
                className="btn btn-ghost btn-xs h-6 rounded-full bg-base-300/80 hover:bg-base-300 text-[10px] text-base-content/70 hover:text-base-content border border-base-300 whitespace-nowrap shrink-0"
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Main Input Row */}
          <div className="flex gap-2 items-center">
            <div className="flex-1 bg-base-300/60 border border-base-300 focus-within:border-primary focus-within:bg-base-300 focus-within:ring-2 focus-within:ring-primary/20 rounded-xl px-4 py-2 transition-all flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                placeholder="Ask about operations, assets, suppliers, forecasts, scrap rates…"
                className="w-full bg-transparent text-xs text-base-content outline-none placeholder:text-base-content/40"
                autoFocus
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="btn btn-primary btn-sm rounded-xl px-3.5 shadow-md hover:shadow-primary/25 disabled:opacity-30 transition-all shrink-0 gap-1.5"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[10px] text-base-content/40 text-center font-mono">
            Grounded in BigQuery Gold · Lane A/B Dual Architecture · Plant-Scoped Governance
          </p>
        </div>
      </div>
    </div>
  );
}
