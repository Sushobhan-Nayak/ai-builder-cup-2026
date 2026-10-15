"use client";
import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { sendChatMessage } from "@/lib/api-client";

const SUGGESTIONS = [
  "Why is OEE down in Pune today?",
  "Show scrap trend for Rayong last 7 days",
  "What's the blast radius of Formosa Semicon?",
  "Can we ship 5,000 TM-300 to Kirin by Nov 30?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const MOCK_RESPONSES: Record<string, string> = {
  default: "Based on the latest data from BigQuery, OEE at Pune dropped 2.1 pp driven by CNC-07 availability losses (−1.4 pp) and a minor quality loss on Line 2 (−0.7 pp). The CNC-07 bearing fault is the root cause — Sentinel has already raised a maintenance recommendation. [ev:sql-12] [ev:sql-15]",
  oee:     "OEE at Pune is 78.4% today, down 2.1 pp from yesterday. The main driver is CNC-07 availability (bearing fault, RUL 68h). Line 2 quality losses account for 0.7 pp due to the porosity trend at Rayong. [ev:sql-12]",
  scrap:   "Rayong scrap rate is 3.2% this week, up 0.8 pp. The primary driver is porosity defects on HSG-220 castings (lot L-4471). Die temperature drifted −18°C over 4h — Inspector has flagged this. [ev:sql-8] [ev:gql-2]",
  blast:   "Formosa Semicon blast radius: 2 parts → 3 SKUs → 11 open orders → 2 customers (Kirin Mobility, Zenith Motors). Revenue at risk: $1.82M. Stock-out in 9 days. A War Room has been convened. [ev:gql-1]",
  kirin:   "CTP analysis for 5,000 TM-300 to Kirin by Nov 30: Feasible for 3,800 units (confidence 92%). Remaining 1,200 by Dec 6, or all 5,000 by Nov 30 with Saturday OT at +$11.2k. [ev:sql-12] [ev:opt-3]",
};

function getResponse(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes("oee")) return MOCK_RESPONSES.oee;
  if (l.includes("scrap") || l.includes("rayong")) return MOCK_RESPONSES.scrap;
  if (l.includes("blast") || l.includes("formosa")) return MOCK_RESPONSES.blast;
  if (l.includes("kirin") || l.includes("5,000") || l.includes("ctp")) return MOCK_RESPONSES.kirin;
  return MOCK_RESPONSES.default;
}

export function CopilotDrawer() {
  const { copilotOpen, setCopilotOpen } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setStreaming(true);

    let streamText = "";

    try {
      const liveRes = await sendChatMessage(text, {
        page: typeof window !== "undefined" ? window.location.pathname : "/",
      });
      streamText = liveRes?.content || liveRes?.message || liveRes?.reply || liveRes?.text || getResponse(text);
    } catch {
      streamText = getResponse(text);
    }

    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: streamText.slice(0, i),
          streaming: i < streamText.length,
        };
        return updated;
      });
      if (i >= streamText.length) {
        clearInterval(interval);
        setStreaming(false);
      }
    }, 18);
  };

  if (!copilotOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[#111318] border-l border-white/[0.06] flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <Sparkles className="w-4 h-4 text-[#7c8fff]" />
        <span className="text-sm font-medium text-[#f1f3f6]">Ask GembaOS</span>
        <span className="text-xs text-[#4e5668] ml-1">Copilot</span>
        <button onClick={() => setCopilotOpen(false)} className="ml-auto text-[#4e5668] hover:text-[#8a93a6] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-[#4e5668]">Ask anything about your operations. I have context from all 3 plants.</p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left text-xs bg-white/4 hover:bg-white/7 text-[#8a93a6] hover:text-[#f1f3f6] px-3 py-2 rounded-lg transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-[#5b73ff] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={cn(
              "max-w-[85%] rounded-xl px-3 py-2 text-sm",
              msg.role === "user"
                ? "bg-[#5b73ff]/15 text-[#f1f3f6] rounded-tr-sm"
                : "bg-[#17191f] text-[#f1f3f6] rounded-tl-sm"
            )}>
              <p className="leading-relaxed whitespace-pre-wrap text-xs">
                {msg.content}
                {msg.streaming && <span className="cursor-blink ml-0.5 text-[#7c8fff]">▋</span>}
              </p>
              {!msg.streaming && msg.role === "assistant" && msg.content.includes("[ev:") && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {msg.content.match(/\[ev:[^\]]+\]/g)?.map((ev) => (
                    <span key={ev} className="text-[10px] bg-white/5 text-[#7c8fff] px-1.5 py-0.5 rounded cursor-pointer hover:bg-white/8 transition-colors">
                      {ev}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {streaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div className="flex gap-1.5 px-2 items-center">
            <span className="w-1.5 h-1.5 bg-[#7c8fff] rounded-full dot-1" />
            <span className="w-1.5 h-1.5 bg-[#7c8fff] rounded-full dot-2" />
            <span className="w-1.5 h-1.5 bg-[#7c8fff] rounded-full dot-3" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask about operations…"
            className="flex-1 bg-white/5 focus:bg-white/8 text-[#f1f3f6] text-sm rounded-lg px-3 py-2 outline-none placeholder:text-[#4e5668] transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="bg-[#5b73ff] hover:bg-[#4a62ee] disabled:opacity-40 text-white p-2 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-[#4e5668] mt-1.5 text-center">
          Grounded in BigQuery · Evidence-cited · NL→SQL
        </p>
      </div>
    </div>
  );
}
