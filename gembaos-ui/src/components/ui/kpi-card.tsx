"use client";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  status?: "ok" | "warn" | "crit" | "info";
  className?: string;
  compact?: boolean;
}

const valueColor: Record<string, string> = {
  ok:   "text-base-content",
  warn: "text-warning",
  crit: "text-error",
  info: "text-primary",
};

export function KpiCard({ label, value, unit, delta, status = "ok", className, compact }: KpiCardProps) {
  const deltaPositive = delta !== undefined && delta > 0;
  const deltaNegative = delta !== undefined && delta < 0;

  return (
    <div className={cn("stat bg-base-200 rounded-xl shadow-sm", compact ? "p-3" : "p-4", className)}>
      <div className="stat-title text-[10px] uppercase tracking-widest">{label}</div>
      <div className={cn("stat-value tabular", compact ? "text-xl" : "text-2xl", valueColor[status])}>
        {value}{unit && <span className="text-sm font-normal text-base-content/40 ml-1">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className={cn(
          "stat-desc flex items-center gap-0.5 text-[11px]",
          deltaPositive ? "text-success" : deltaNegative ? "text-error" : "text-base-content/40"
        )}>
          {deltaPositive && <TrendingUp className="w-3 h-3" />}
          {deltaNegative && <TrendingDown className="w-3 h-3" />}
          <span>{delta > 0 ? "+" : ""}{delta}{unit}</span>
        </div>
      )}
    </div>
  );
}
