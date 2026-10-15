"use client";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiItem {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  status?: "ok" | "warn" | "crit" | "info";
}

const valueColor: Record<string, string> = {
  ok:   "text-base-content",
  warn: "text-warning",
  crit: "text-error",
  info: "text-primary",
};

export function KpiChip({ label, value, unit, delta, status = "ok", className }: KpiItem & { className?: string }) {
  const deltaPositive = delta !== undefined && delta > 0;
  const deltaNegative = delta !== undefined && delta < 0;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-base-200 rounded-lg", className)}>
      <span className="text-[9px] uppercase tracking-widest text-base-content/40 font-medium">{label}</span>
      <span className={cn("tabular font-semibold text-xs", valueColor[status])}>
        {value}{unit && <span className="text-[10px] font-normal text-base-content/40 ml-0.5">{unit}</span>}
      </span>
      {delta !== undefined && (
        <span className={cn(
          "flex items-center gap-0.5 text-[10px]",
          deltaPositive ? "text-success" : deltaNegative ? "text-error" : "text-base-content/40"
        )}>
          {deltaPositive && <TrendingUp className="w-3 h-3" />}
          {deltaNegative && <TrendingDown className="w-3 h-3" />}
          {delta > 0 ? "+" : ""}{delta}{unit}
        </span>
      )}
    </div>
  );
}

interface KpiTickerProps {
  items: KpiItem[];
  className?: string;
}

export function KpiTicker({ items, className }: KpiTickerProps) {
  const doubled = [...items, ...items];

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-10 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, oklch(var(--b1)), transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-10 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, oklch(var(--b1)), transparent)" }} />

      <div
        className="flex gap-2 w-max"
        style={{ animation: "ticker 25s linear infinite" }}
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((item, i) => (
          <KpiChip key={i} {...item} />
        ))}
      </div>
    </div>
  );
}
