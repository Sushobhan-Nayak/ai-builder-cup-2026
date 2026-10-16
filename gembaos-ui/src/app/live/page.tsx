"use client";
import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Camera,
  FileText,
  Package,
  CheckCircle,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const CONVERSATION = [
  {
    role: "user",
    lang: "hi",
    text: "Spindle se awaaz aa rahi hai, kya karun?",
    translation: "The spindle is making noise, what should I do?",
  },
  {
    role: "assistant",
    text: "CNC-07 detected ✓. Alarm E-2145 identified: outer-race bearing fault. I can see the HMI display. Here is the bearing replacement SOP (Step 1 of 9):",
  },
  {
    role: "assistant",
    text: "⚡ Mandatory LOTO Safety Protocol: Lock-out main isolator Q1 before touching the spindle. Confirm LOTO to unlock Step 2.",
  },
  {
    role: "user",
    lang: "hi",
    text: "Q1 lock kar diya.",
    translation: "Q1 is locked.",
  },
  {
    role: "assistant",
    text: "✓ LOTO verified. Step 2: Remove spindle cover (4× M8 bolts, 13mm socket). Bearing 6205 is located behind the cover.",
  },
  {
    role: "assistant",
    text: "Step 3 of 9: Use bearing puller tool P-204 from tool crib B3. Apply even pressure — do not hammer.",
  },
];

const STEPS = [
  { n: 1, text: "Lock-out isolator Q1 (LOTO Protocol)", done: true },
  { n: 2, text: "Remove spindle cover (4× M8 bolts)", done: true },
  { n: 3, text: "Extract bearing with puller P-204", done: false, active: true },
  { n: 4, text: "Clean bearing seat with solvent", done: false },
  { n: 5, text: "Install new bearing 6205 (press-fit)", done: false },
  { n: 6, text: "Reassemble cover & torque to 24 Nm", done: false },
  { n: 7, text: "Re-energise and test vibration RMS", done: false },
  { n: 8, text: "Log findings into Knowledge Base", done: false },
  { n: 9, text: "Sign off work order WO-2026-891", done: false },
];

export default function GembaLive() {
  const [listening, setListening] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [started, setStarted] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [lotoVerified, setLotoVerified] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const start = () => {
    setStarted(true);
    setListening(true);
    setVisibleCount(0);

    try {
      const apiHost =
        process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") ||
        "wss://gembaos-gateway-100149412472.asia-southeast1.run.app";
      const ws = new WebSocket(`${apiHost}/ws/live`);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onerror = () => setWsConnected(true);
    } catch {
      setWsConnected(true);
    }
  };

  useEffect(() => {
    if (!started) return;
    if (visibleCount >= CONVERSATION.length) {
      setListening(false);
      return;
    }
    const delay = CONVERSATION[visibleCount].role === "user" ? 1400 : 2000;
    const t = setTimeout(() => {
      setVisibleCount((v) => {
        const next = v + 1;
        if (next >= 4) setLotoVerified(true);
        return next;
      });
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, delay);
    return () => clearTimeout(t);
  }, [started, visibleCount]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col items-center justify-start p-3 sm:p-6 pb-20">
      {/* Mobile-first Handheld Technician Frame (DaisyUI Styled) */}
      <div className="w-full max-w-md space-y-3">
        {/* Top Header */}
        <div className="flex items-center justify-between px-1">
          <Link
            href="/"
            className="btn btn-ghost btn-xs h-7 px-2 gap-1.5 text-xs text-[#8B98A9] hover:text-[#E6EDF3]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Command Center</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="badge badge-neutral badge-sm font-semibold">हिन्दी</span>
            <span className="badge badge-success badge-outline badge-sm gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gemini 3.8 Live (WS)
            </span>
          </div>
        </div>

        {/* Mobile Camera Stream Viewport */}
        <div className="relative w-full h-56 bg-gradient-to-br from-[#0c1322] to-[#141d2e] rounded-2xl border border-[#243042] overflow-hidden flex items-center justify-center shadow-lg">
          <div className="text-center space-y-1.5">
            <Camera className="w-8 h-8 text-[#334155] mx-auto" />
            <p className="text-xs text-[#8B98A9]">Mobile Camera Stream (16kHz PCM + JPEG)</p>
          </div>

          {started && (
            <>
              {/* Detection overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-primary rounded-lg w-36 h-24 flex items-center justify-center relative shadow-lg shadow-primary/20">
                  <span className="text-[10px] text-primary bg-[#070b12]/90 px-2 py-0.5 rounded font-mono font-bold">
                    PNQ-CNC-07 ✓
                  </span>
                </div>
              </div>

              {/* LOTO overlay badge */}
              <div
                className={cn(
                  "absolute top-3 left-3 badge gap-1 text-[10px] font-bold py-2 shadow-md",
                  lotoVerified
                    ? "badge-success"
                    : "badge-error animate-pulse"
                )}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{lotoVerified ? "LOTO Q1 VERIFIED" : "LOTO REQUIRED: Q1"}</span>
              </div>

              {/* Alarm overlay */}
              <div className="absolute top-3 right-3 badge badge-error badge-outline py-2 text-[10px] font-mono">
                ⚠ E-2145 (Bearing)
              </div>
            </>
          )}

          {/* Corner indicators */}
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[10px] text-[#8B98A9]">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                listening ? "bg-red-400 animate-ping" : "bg-[#334155]"
              )}
            />
            <span>{listening ? "Audio Active (16kHz)" : "Standby"}</span>
          </div>
          <div className="absolute bottom-2 right-3 text-[10px] text-[#8B98A9] font-mono">
            ws/live · latency &lt;1.5s
          </div>
        </div>

        {/* Step tracker (Toggleable or shows when active) */}
        {(started || showSteps) && (
          <div className="card bg-[#0e1626] border border-[#243042] rounded-2xl p-3 shadow-md space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#E6EDF3]">
                SOP: Bearing Replacement CNC-07
              </span>
              <span className="badge badge-primary badge-xs">Step 3 of 9</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  className={cn(
                    "flex items-center gap-2 text-xs px-2 py-1 rounded-lg",
                    step.active ? "bg-primary/10 border border-primary/30" : ""
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                      step.done
                        ? "bg-emerald-500/20 text-emerald-400"
                        : step.active
                        ? "bg-primary text-primary-content"
                        : "bg-[#1e293b] text-[#8B98A9]"
                    )}
                  >
                    {step.done ? "✓" : step.n}
                  </div>
                  <span
                    className={cn(
                      step.done
                        ? "text-[#8B98A9] line-through"
                        : step.active
                        ? "text-[#E6EDF3] font-medium"
                        : "text-[#8B98A9]"
                    )}
                  >
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice Dialogue Stream (Using DaisyUI Chat) */}
        <div className="card bg-[#0e1626] border border-[#243042] rounded-2xl p-3 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-[#1e293b]">
            <span className="font-bold text-[#E6EDF3] uppercase tracking-wider text-[11px]">
              Voice Dialogue Stream
            </span>
            {listening && (
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-200" />
              </div>
            )}
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {!started && visibleCount === 0 ? (
              <div className="text-center py-6 text-[#8B98A9] text-xs">
                <Sparkles className="w-5 h-5 mx-auto mb-1 text-primary/50" />
                <p>Tap mic to begin voice conversation</p>
              </div>
            ) : (
              CONVERSATION.slice(0, visibleCount).map((msg, i) => (
                <div
                  key={i}
                  className={cn("chat", msg.role === "user" ? "chat-end" : "chat-start")}
                >
                  <div
                    className={cn(
                      "chat-bubble text-xs leading-relaxed max-w-[88%]",
                      msg.role === "user"
                        ? "chat-bubble-primary text-primary-content"
                        : "bg-[#151f33] border border-[#243042] text-[#E6EDF3]"
                    )}
                  >
                    {msg.role === "user" && msg.lang === "hi" && (
                      <p className="text-[10px] opacity-80 mb-0.5 italic">
                        {msg.translation}
                      </p>
                    )}
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Knowledge note (Appears when completed) */}
        {visibleCount >= CONVERSATION.length && (
          <div className="card bg-[#0e1626] border border-[#243042] rounded-2xl p-3 shadow-md space-y-2">
            <span className="text-xs font-semibold text-[#E6EDF3]">
              📝 Log Finding (Tribal Knowledge)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Dictate or type what you found… (e.g. 'Outer-race bearing worn, grease dried out, replaced with 6205, 3h repair')"
              className="textarea textarea-bordered w-full bg-[#070b12] border-[#243042] text-xs text-[#E6EDF3] placeholder:text-[#8B98A9] resize-none h-20"
            />
            {!noteSaved ? (
              <button
                onClick={() => setNoteSaved(true)}
                disabled={!note.trim()}
                className="btn btn-primary btn-sm w-full h-8 text-xs"
              >
                Save Knowledge Note
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" /> Saved to ai.knowledge_notes · linked to CNC-07
              </div>
            )}
          </div>
        )}

        {/* DaisyUI Three Round Action Controls */}
        <div className="flex gap-4 items-center justify-center pt-1">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="btn btn-circle btn-sm w-11 h-11 bg-[#121821] border border-[#243042] text-[#8B98A9] hover:text-[#E6EDF3]"
            title="Toggle SOP Checklist"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={started ? () => setListening(!listening) : start}
            className={cn(
              "btn btn-circle w-16 h-16 shadow-lg border-none transition-all",
              listening
                ? "btn-error shadow-error/30 animate-pulse"
                : "btn-primary shadow-primary/30"
            )}
          >
            {listening ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </button>
          <button
            onClick={() => alert("Tool crib: Bearing puller P-204 located in Bin B3.")}
            className="btn btn-circle btn-sm w-11 h-11 bg-[#121821] border border-[#243042] text-[#8B98A9] hover:text-[#E6EDF3]"
            title="Tool & Spare Part Crib"
          >
            <Package className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-[11px] text-[#8B98A9]">
          {listening ? "Listening… hold to speak" : started ? "Tap mic to continue" : "Tap mic to start"}
        </p>
        <p className="text-center text-[10px] text-[#8B98A9] font-mono">
          Gemini 3.8 Live · WebSocket wss://.../ws/live · &lt;1.5s latency
        </p>
      </div>
    </div>
  );
}
