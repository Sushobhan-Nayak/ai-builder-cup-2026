"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPLIERS } from "@/lib/mock-data";
import { Compass, AlertTriangle, CheckCircle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchBlastRadius } from "@/lib/api-client";

const NETWORK_NODES = [
  { id: "SUP-FORMOSA", label: "Formosa Semicon", type: "supplier", x: 10, y: 20, risk: "critical" },
  { id: "SUP-PENANG", label: "Penang Micro", type: "supplier", x: 10, y: 50, risk: "ok" },
  { id: "SUP-NSK", label: "NSK Japan", type: "supplier", x: 10, y: 80, risk: "ok" },
  { id: "PORT-KEE", label: "Keelung Port", type: "port", x: 35, y: 20, risk: "high" },
  { id: "PORT-PEN", label: "Penang Port", type: "port", x: 35, y: 50, risk: "ok" },
  { id: "PNQ", label: "Pune Plant", type: "plant", x: 60, y: 35, risk: "warn" },
  { id: "RYG", label: "Rayong Plant", type: "plant", x: 60, y: 65, risk: "ok" },
  { id: "CUST-KIRIN", label: "Kirin Mobility", type: "customer", x: 88, y: 25, risk: "ok" },
  { id: "CUST-ZENITH", label: "Zenith Motors", type: "customer", x: 88, y: 55, risk: "ok" },
];

const EDGES = [
  { from: "SUP-FORMOSA", to: "PORT-KEE", risk: "critical" },
  { from: "SUP-PENANG", to: "PORT-PEN", risk: "ok" },
  { from: "PORT-KEE", to: "PNQ", risk: "critical" },
  { from: "PORT-PEN", to: "PNQ", risk: "ok" },
  { from: "SUP-NSK", to: "PNQ", risk: "ok" },
  { from: "PNQ", to: "CUST-KIRIN", risk: "ok" },
  { from: "PNQ", to: "CUST-ZENITH", risk: "ok" },
  { from: "RYG", to: "CUST-ZENITH", risk: "ok" },
];

const riskColor: Record<string, string> = {
  critical: "#EF4444", high: "#F97316", warn: "#F59E0B", ok: "#22C55E",
};

function NetworkMap() {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="relative w-full h-56 bg-[#0B0F14] rounded-xl border border-[#243042] overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {EDGES.map((e, i) => {
          const from = NETWORK_NODES.find((n) => n.id === e.from)!;
          const to = NETWORK_NODES.find((n) => n.id === e.to)!;
          return (
            <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={riskColor[e.risk]} strokeWidth="0.5" strokeOpacity="0.6"
              strokeDasharray={e.risk === "critical" ? "2 1" : undefined} />
          );
        })}
      </svg>
      {NETWORK_NODES.map((node) => (
        <div
          key={node.id}
          className="absolute cursor-pointer group"
          style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%,-50%)" }}
          onMouseEnter={() => setHovered(node.id)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className={cn("w-3 h-3 rounded-full border-2 transition-transform group-hover:scale-150",
            node.type === "supplier" ? "rounded-sm rotate-45" : node.type === "port" ? "rounded-none" : "rounded-full"
          )} style={{ backgroundColor: riskColor[node.risk] + "40", borderColor: riskColor[node.risk] }} />
          {hovered === node.id && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
              <div className="bg-[#121821] border border-[#243042] rounded-lg px-2 py-1 text-[10px] whitespace-nowrap shadow-xl">
                <p className="text-[#E6EDF3] font-medium">{node.label}</p>
                <p className="text-[#8B98A9] capitalize">{node.type} · {node.risk}</p>
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="absolute bottom-2 left-2 flex gap-2 text-[9px] text-[#8B98A9]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Critical</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Warn</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />OK</span>
      </div>
    </div>
  );
}

export default function SupplyChain() {
  const [blastRunning, setBlastRunning] = useState(false);
  const [blastDone, setBlastDone] = useState(false);

  const runBlast = async () => {
    setBlastRunning(true);
    try {
      await fetchBlastRadius({ event_type: "weather", entity_id: "SUP-FORMOSA" });
    } catch (err) {
      console.warn("fetchBlastRadius error:", err);
    } finally {
      setBlastRunning(false);
      setBlastDone(true);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Compass className="w-5 h-5 text-[#06B6D4]" />
        <h1 className="text-lg font-bold text-[#E6EDF3]">Supply Chain Control Tower</h1>
        <Badge variant="default">Navigator Agent</Badge>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Network map */}
        <div className="col-span-12 lg:col-span-8">
          <NetworkMap />
        </div>

        {/* Disruption list */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader><CardTitle>Active Disruptions</CardTitle></CardHeader>
          <div className="space-y-2">
            {[
              { title: "Typhoon Haikui-2", node: "Keelung Port", severity: "critical", scenario: true },
              { title: "Port congestion", node: "Penang Port", severity: "medium", scenario: false },
            ].map((d, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-[#0B0F14] border border-[#243042] text-xs">
                <div className="flex items-center gap-1.5">
                  <Badge variant={d.severity as "critical" | "medium"}>{d.severity}</Badge>
                  {d.scenario && <Badge variant="scenario">SCENARIO</Badge>}
                </div>
                <p className="text-[#E6EDF3] font-medium mt-1">{d.title}</p>
                <p className="text-[#8B98A9]">{d.node}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Blast radius */}
        <Card className="col-span-12 lg:col-span-6" glow={blastDone}>
          <CardHeader>
            <CardTitle>Blast Radius Analysis</CardTitle>
            <Button size="sm" variant="primary" onClick={runBlast} disabled={blastRunning}>
              {blastRunning ? "Running GQL…" : "Run for Formosa Semicon"}
            </Button>
          </CardHeader>
          {blastDone ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle className="w-3.5 h-3.5" /> BigQuery Graph traversal complete [ev:gql-1]
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Parts affected", value: "2", color: "text-red-400" },
                  { label: "SKUs affected", value: "3", color: "text-orange-400" },
                  { label: "Open orders", value: "11", color: "text-yellow-400" },
                  { label: "Revenue at risk", value: "$1.82M", color: "text-red-400" },
                  { label: "Customers", value: "2", color: "text-[#E6EDF3]" },
                  { label: "Stock-out in", value: "9 days", color: "text-red-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#0B0F14] border border-[#243042] rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-[#8B98A9]">{label}</p>
                    <p className={cn("text-base font-bold tabular mt-0.5", color)}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#E6EDF3] flex-wrap bg-[#0B0F14] border border-[#243042] rounded-lg p-2">
                {["Supplier", "→ 2 Parts", "→ 3 SKUs", "→ 11 SOs", "→ 2 Customers"].map((n, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-[#8B98A9]">→</span>}
                    <span className="bg-[#1A2230] px-1.5 py-0.5 rounded border border-[#243042]">{n.replace("→ ", "")}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#8B98A9]">Select a supplier and run the BigQuery Graph GQL traversal to see downstream impact.</p>
          )}
        </Card>

        {/* Inventory */}
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader><CardTitle>Inventory Health</CardTitle></CardHeader>
          <div className="space-y-1.5">
            {[
              { sku: "Gate-driver IC", plant: "PNQ", days: 9, status: "critical" },
              { sku: "Current-sensor IC", plant: "PNQ", days: 12, status: "high" },
              { sku: "Bearing 6205", plant: "PNQ", days: 3, status: "critical" },
              { sku: "NdFeB Magnet", plant: "PNQ", days: 28, status: "ok" },
              { sku: "Aluminium Ingot", plant: "RYG", days: 45, status: "ok" },
            ].map((item) => (
              <div key={item.sku} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-[#0B0F14] border border-[#243042]">
                <div className={cn("w-2 h-2 rounded-full shrink-0",
                  item.status === "critical" ? "bg-red-400" : item.status === "high" ? "bg-orange-400" : "bg-green-400"
                )} />
                <span className="flex-1 text-[#E6EDF3]">{item.sku}</span>
                <span className="text-[#8B98A9]">{item.plant}</span>
                <span className={cn("font-bold tabular", item.days < 14 ? "text-red-400" : "text-green-400")}>{item.days}d</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
