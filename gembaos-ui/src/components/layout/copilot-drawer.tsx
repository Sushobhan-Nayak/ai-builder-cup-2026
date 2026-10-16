"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  ChevronRight,
  User,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendChatMessage } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

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
        return (
          <strong key={j} className="text-base-content font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={j}>{part}</span>;
    });
    if (line.startsWith("•")) {
      return (
        <li key={i} className="ml-4 list-disc text-base-content/80 my-0.5 leading-relaxed">
          {parts}
        </li>
      );
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return (
      <p key={i} className="text-base-content/85 leading-relaxed">
        {parts}
      </p>
    );
  });
}

export function CopilotDrawer() {
  const { copilotOpen, setCopilotOpen } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (copilotOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [copilotOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && copilotOpen) {
        setCopilotOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copilotOpen, setCopilotOpen]);

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
        finalContent = (liveRes.content || liveRes.text || liveRes.message || liveRes.reply || localResp.text) as string;
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
    }, 14);
  };

  const reset = () => {
    setMessages([]);
    setStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!copilotOpen) return null;

  return (
    <>
      {/* Semi-transparent dark blur backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
        onClick={() => setCopilotOpen(false)}
      />

      {/* Main Drawer Container matching the application theme */}
      <div className="fixed inset-y-0 right-0 w-[580px] sm:w-[640px] max-w-[95vw] bg-base-100 border-l border-base-300 flex flex-col z-50 shadow-2xl animate-in slide-in-from-right duration-250 select-none">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-base-300 bg-base-200/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-base-content leading-tight">Ask GembaOS</h2>
              <p className="text-[11px] text-base-content/50 leading-tight">Autonomous Operations Copilot</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>

            {messages.length > 0 && (
              <button
                onClick={reset}
                className="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-base-content hover:bg-base-300 rounded-lg"
                title="New session"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => setCopilotOpen(false)}
              className="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-base-content hover:bg-base-300 rounded-lg ml-1"
              title="Close drawer (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">
                  Operational Inquiries
                </span>
                <span className="text-[10px] font-mono text-base-content/40">
                  Click to run verified query
                </span>
              </div>

              {/* Prompt Cards Grid in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.label)}
                    className="flex items-start gap-2.5 text-left bg-base-200/80 hover:bg-base-200 border border-base-300 hover:border-primary/50 p-3 rounded-xl transition-all group shadow-sm hover:shadow-md cursor-pointer"
                  >
                    <span className="text-base shrink-0 mt-0.5 p-2 bg-base-300 rounded-lg group-hover:scale-105 transition-transform">
                      {s.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                          {s.category}
                        </span>
                        <span className="text-[10px] text-base-content/40 font-mono">via {s.agent}</span>
                      </div>
                      <p className="text-xs font-semibold text-base-content group-hover:text-primary transition-colors leading-snug">
                        {s.label}
                      </p>
                      <p className="text-[11px] text-base-content/50 mt-0.5 line-clamp-1">
                        {s.hint}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-base-content/30 group-hover:text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                      msg.role === "assistant"
                        ? "bg-gradient-to-tr from-primary to-accent text-white"
                        : "bg-base-300 border border-base-300 text-base-content"
                    )}
                  >
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
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-content rounded-tr-sm"
                          : "bg-base-200 border border-base-300 rounded-tl-sm text-base-content"
                      )}
                    >
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
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Console */}
        <div className="p-3 bg-base-200/95 border-t border-base-300 shrink-0">
          <div className="flex items-center gap-2 bg-base-100 border border-base-300 focus-within:border-primary/60 rounded-xl p-1.5 shadow-sm transition-all">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask about operations, assets, suppliers, forecasts, scrap rates…"
              className="input input-ghost input-sm flex-1 text-xs text-base-content placeholder:text-base-content/40 outline-none focus:bg-transparent"
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className={cn(
                "btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm",
                (!input.trim() || streaming) && "btn-disabled opacity-40"
              )}
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
