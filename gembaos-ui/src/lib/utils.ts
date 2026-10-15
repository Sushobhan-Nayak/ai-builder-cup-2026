import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function severityColor(severity: string) {
  switch (severity) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-yellow-400";
    case "low": return "text-blue-400";
    default: return "text-gray-400";
  }
}

export function severityBg(severity: string) {
  switch (severity) {
    case "critical": return "bg-red-500/10 border-red-500/30";
    case "high": return "bg-orange-500/10 border-orange-500/30";
    case "medium": return "bg-yellow-500/10 border-yellow-500/30";
    case "low": return "bg-blue-500/10 border-blue-500/30";
    default: return "bg-gray-500/10 border-gray-500/30";
  }
}

export function stateColor(state: string) {
  switch (state) {
    case "running": return "#22C55E";
    case "idle": return "#8B98A9";
    case "setup": return "#38BDF8";
    case "warning": return "#F59E0B";
    case "down": return "#EF4444";
    default: return "#8B98A9";
  }
}
