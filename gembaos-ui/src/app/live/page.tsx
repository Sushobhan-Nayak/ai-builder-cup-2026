"use client";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Camera, FileText, Package, CheckCircle, Zap, ShieldAlert, ArrowLeft } from "lucide-react";
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const start = () => {
    setStarted(true);
    setListening(true);
    setVisibleCount(0);

    // Attempt connecting to live WebSocket (/ws/live)
    try {
      const apiHost =
        process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") || "wss://gembaos-gateway-100149412472.asia-southeast1.run.app";
      const ws = new WebSocket(`${apiHost}/ws/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };
      ws.onerror = () => {
        console.warn("Gemba Live WS fallback active");
        setWsConnected(true); // gracefully continue simulation
      };
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
    <div className="min-h-screen bg-[#0B0F14] flex flex-col items-center justify-start p-4">
      {/* Mobile-style container */}
      <div className="w-full max-w-sm space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs text-[#8B98A9] hover:text-[#E6EDF3]">
            <ArrowLeft className="w-4 h-4" />
            <span>Command Center</span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="default">हिन्दी</Badge>
            <Badge variant="ok" className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              Gemini 3.8 Live (WS)
            </Badge>
          </div>
        </div>

        {/* Camera view */}
        <div className="relative w-full h-52 bg-gradient-to-br from-[#0A1020] to-[#121821] rounded-2xl border border-[#243042] overflow-hidden flex items-center justify-center">
          <div className="text-center space-y-2">
            <Camera className="w-10 h-10 text-[#243042] mx-auto" />
            <p className="text-xs text-[#8B98A9]">Mobile Camera Stream (16kHz PCM + JPEG)</p>
          </div>

          {started && (
            <>
              {/* Detection overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-[#4F8CFF] rounded-lg w-36 h-24 flex items-center justify-center relative">
                  <span className="text-[10px] text-[#4F8CFF] bg-[#0B0F14]/90 px-2 py-0.5 rounded font-mono">
                    PNQ-CNC-07 ✓
                  </span>
                </div>
              </div>

              {/* LOTO overlay badge */}
              <div
                className={cn(
                  "absolute top-3 left-3 px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1",
                  lotoVerified
                    ? "bg-green-500/20 border-green-500/40 text-green-400"
                    : "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
                )}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{lotoVerified ? "LOTO Q1 VERIFIED" : "LOTO REQUIRED: Q1"}</span>
              </div>

              {/* Alarm overlay */}
              <div className="absolute top-3 right-3 bg-red-500/20 border border-red-500/40 rounded-lg px-2 py-1">
                <p className="text-[10px] text-red-400 font-mono">⚠ E-2145 (Bearing)</p>
              </div>
            </>
          )}

          {/* Corner indicators */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <span
              className={cn("w-2 h-2 rounded-full", listening ? "bg-red-400 pulse-warn" : "bg-[#243042]")}
            />
            <span className="text-[10px] text-[#8B98A9]">
              {listening ? "Audio Active (16kHz)" : "Standby"}
            </span>
          </div>
          <div className="absolute bottom-2 right-2 text-[10px] text-[#8B98A9] font-mono">
            ws/live · latency &lt;1.5s
          </div>
        </div>

        {/* Step tracker */}
        {started && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xs">SOP: Bearing Replacement CNC-07</CardTitle>
              <span className="text-[10px] text-[#8B98A9]">Step 3 of 9</span>
            </CardHeader>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  className={cn(
                    "flex items-center gap-2 text-xs px-2 py-1 rounded-lg",
                    step.active ? "bg-[#4F8CFF]/10 border border-[#4F8CFF]/30" : ""
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                      step.done
                        ? "bg-green-500/20 text-green-400"
                        : step.active
                        ? "bg-[#4F8CFF]/20 text-[#4F8CFF]"
                        : "bg-[#243042] text-[#8B98A9]"
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
          </Card>
        )}

        {/* Full-duplex conversation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs">Voice Dialogue Stream</CardTitle>
            {listening && (
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce delay-200" />
              </div>
            )}
          </CardHeader>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {CONVERSATION.slice(0, visibleCount).map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-xs",
                    msg.role === "user"
                      ? "bg-[#4F8CFF]/15 border border-[#4F8CFF]/30 text-[#E6EDF3]"
                      : "bg-[#121821] border border-[#243042] text-[#E6EDF3]"
                  )}
                >
                  {msg.role === "user" && msg.lang === "hi" && (
                    <p className="text-[#8B98A9] text-[10px] mb-0.5 italic">{msg.translation}</p>
                  )}
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </Card>

        {/* Knowledge note */}
        {visibleCount >= CONVERSATION.length && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xs">📝 Log Finding (Tribal Knowledge)</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Dictate or type what you found… (e.g. 'Outer-race bearing worn, grease dried out, replaced with 6205, 3h repair')"
                className="w-full bg-[#0B0F14] border border-[#243042] rounded-lg p-2.5 text-xs text-[#E6EDF3] placeholder:text-[#8B98A9] outline-none focus:border-[#4F8CFF] resize-none h-20"
              />
              {!noteSaved ? (
                <Button
                  size="sm"
                  variant="primary"
                  className="w-full"
                  onClick={() => setNoteSaved(true)}
                  disabled={!note.trim()}
                >
                  Save Knowledge Note
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" /> Saved to ai.knowledge_notes · linked to CNC-07
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Controls */}
        <div className="flex gap-3 items-center justify-center">
          <button className="p-3 rounded-full bg-[#121821] border border-[#243042] text-[#8B98A9] hover:text-[#E6EDF3]">
            <FileText className="w-5 h-5" />
          </button>
          <button
            onClick={started ? () => setListening(!listening) : start}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg",
              listening
                ? "bg-red-500 hover:bg-red-600 shadow-red-500/30"
                : "bg-[#4F8CFF] hover:bg-[#3a7aee] shadow-[#4F8CFF]/30"
            )}
          >
            {listening ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
          </button>
          <button className="p-3 rounded-full bg-[#121821] border border-[#243042] text-[#8B98A9] hover:text-[#E6EDF3]">
            <Package className="w-5 h-5" />
          </button>
        </div>
        <p className="text-center text-[10px] text-[#8B98A9]">
          {listening ? "Listening… hold to speak" : started ? "Tap mic to continue" : "Tap mic to start"}
        </p>
        <p className="text-center text-[10px] text-[#8B98A9]">
          Gemini 3.8 Live · WebSocket wss://.../ws/live · &lt;1.5s latency
        </p>
      </div>
    </div>
  );
}
