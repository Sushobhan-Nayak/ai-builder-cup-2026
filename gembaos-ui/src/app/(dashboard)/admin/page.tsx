"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Shield, Bot, GitBranch, BarChart2, Plug, Users, ChevronRight,
  CheckCircle, Clock, AlertTriangle, Activity, Zap,
} from "lucide-react";

// ── Autonomy Policies ──────────────────────────────────────────────────────
const POLICIES = [
  { action: "Create Work Order",      domain: "Maintenance", level: "L2", threshold: "Any",       role: "maintenance" },
  { action: "Reserve Spare Part",     domain: "Maintenance", level: "L3", threshold: "< 1 unit",  role: "policy:auto" },
  { action: "Draft Purchase Order",   domain: "Procurement", level: "L2", threshold: "Any",       role: "buyer" },
  { action: "Auto-approve PO",        domain: "Procurement", level: "L3", threshold: "< $5,000",  role: "policy:auto" },
  { action: "Reschedule Production",  domain: "Planning",    level: "L2", threshold: "Any",       role: "planner" },
  { action: "Customer Notification",  domain: "Sales",       level: "L2", threshold: "Any",       role: "plant_manager" },
  { action: "Load Shift Schedule",    domain: "Energy",      level: "L3", threshold: "< 10% OT",  role: "policy:auto" },
];

const LEVEL_STYLE: Record<string, string> = {
  L0: "badge-ghost",
  L1: "badge-info badge-outline",
  L2: "badge-warning badge-outline",
  L3: "badge-success badge-outline",
};

function PoliciesTab() {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr className="text-base-content/40 text-[11px] uppercase tracking-widest">
            <th>Action Type</th>
            <th>Domain</th>
            <th>Autonomy Level</th>
            <th>Threshold</th>
            <th>Approver Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {POLICIES.map((p, i) => (
            <tr key={i} className="hover">
              <td className="text-sm font-medium">{p.action}</td>
              <td className="text-sm text-base-content/60">{p.domain}</td>
              <td><span className={cn("badge badge-sm", LEVEL_STYLE[p.level])}>{p.level}</span></td>
              <td className="text-sm text-base-content/60 font-mono">{p.threshold}</td>
              <td className="text-sm text-base-content/60">{p.role}</td>
              <td><button className="btn btn-ghost btn-xs">Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-1 pt-4">
        <div className="alert alert-info text-xs py-2">
          <Shield className="w-4 h-4 shrink-0" />
          <span>L0 = Inform only · L1 = Recommend · L2 = Act with approval · L3 = Act and notify (within threshold)</span>
        </div>
      </div>
    </div>
  );
}

// ── Agent Registry ─────────────────────────────────────────────────────────
const AGENTS = [
  { id: "orchestrator", name: "Orchestrator",  role: "Plant Director",          model: "gemini-3.8-flash", status: "healthy", calls: 142, p95: "1.2s" },
  { id: "sentinel",     name: "Sentinel",      role: "Reliability Engineer",    model: "gemini-3.8-flash", status: "healthy", calls: 89,  p95: "2.1s" },
  { id: "inspector",    name: "Inspector",     role: "Quality Engineer",        model: "gemini-3.8-flash", status: "healthy", calls: 34,  p95: "3.4s" },
  { id: "planner",      name: "Planner",       role: "Production Scheduler",    model: "gemini-3.8-flash", status: "healthy", calls: 56,  p95: "4.8s" },
  { id: "procurer",     name: "Procurer",      role: "Strategic Buyer",         model: "gemini-3.8-flash", status: "healthy", calls: 28,  p95: "2.9s" },
  { id: "navigator",    name: "Navigator",     role: "Supply Chain Analyst",    model: "gemini-3.8-flash", status: "healthy", calls: 41,  p95: "3.1s" },
  { id: "oracle",       name: "Oracle",        role: "Demand Planner",          model: "gemini-3.8-flash", status: "idle",    calls: 12,  p95: "5.2s" },
  { id: "scout",        name: "Scout",         role: "Market Intelligence",     model: "gemini-3.5-flash-lite", status: "healthy", calls: 203, p95: "0.8s" },
  { id: "verdant",      name: "Verdant",       role: "Sustainability Engineer", model: "gemini-3.8-flash", status: "idle",    calls: 8,   p95: "2.4s" },
  { id: "ledger",       name: "Ledger",        role: "Plant Controller",        model: "gemini-3.5-flash-lite", status: "healthy", calls: 67, p95: "1.1s" },
  { id: "analyst",      name: "Analyst",       role: "Data Analyst",            model: "gemini-3.8-flash", status: "healthy", calls: 95,  p95: "3.7s" },
  { id: "critic",       name: "Critic",        role: "Verifier",                model: "gemini-3.1-pro",   status: "healthy", calls: 38,  p95: "6.2s" },
];

const STATUS_STYLE: Record<string, string> = {
  healthy: "text-success",
  idle:    "text-base-content/40",
  error:   "text-error",
};

function AgentsTab() {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr className="text-base-content/40 text-[11px] uppercase tracking-widest">
            <th>Agent</th>
            <th>Role</th>
            <th>Model</th>
            <th>Status</th>
            <th>Calls (24h)</th>
            <th>p95 Latency</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {AGENTS.map((a) => (
            <tr key={a.id} className="hover">
              <td className="font-medium text-sm">{a.name}</td>
              <td className="text-sm text-base-content/60">{a.role}</td>
              <td className="text-xs font-mono text-base-content/50">{a.model}</td>
              <td>
                <span className={cn("flex items-center gap-1.5 text-xs font-medium", STATUS_STYLE[a.status])}>
                  <span className={cn("w-1.5 h-1.5 rounded-full inline-block",
                    a.status === "healthy" ? "bg-success" : a.status === "idle" ? "bg-base-content/20" : "bg-error"
                  )} />
                  {a.status}
                </span>
              </td>
              <td className="text-sm tabular">{a.calls}</td>
              <td className="text-sm tabular text-base-content/60">{a.p95}</td>
              <td><button className="btn btn-ghost btn-xs gap-1"><Activity className="w-3 h-3" />Trace</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Trace Explorer ─────────────────────────────────────────────────────────
const TRACES = [
  { id: "dec_001", title: "CNC-07 bearing maintenance",     agent: "Sentinel → Planner → Procurer", duration: "4.2s",  tokens: "12,400", status: "approved",  ts: "07:34" },
  { id: "dec_002", title: "Typhoon Haikui-2 War Room",      agent: "Orchestrator × 6 agents",       duration: "38.1s", tokens: "84,200", status: "approved",  ts: "07:41" },
  { id: "dec_003", title: "Casting porosity RCA",           agent: "Inspector → Analyst",           duration: "6.8s",  tokens: "18,900", status: "completed", ts: "08:12" },
  { id: "dec_004", title: "Kirin CTP query",                agent: "Oracle → Planner → Ledger",     duration: "9.1s",  tokens: "22,100", status: "completed", ts: "08:55" },
  { id: "dec_005", title: "Reorder bearings 6205",          agent: "Sentinel → Procurer",           duration: "3.4s",  tokens: "8,700",  status: "pending",   ts: "09:02" },
];

const TRACE_STATUS: Record<string, string> = {
  approved:  "badge-success badge-outline",
  completed: "badge-info badge-outline",
  pending:   "badge-warning badge-outline",
};

function TraceTab() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      {TRACES.map((t) => (
        <div key={t.id} className="bg-base-300 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-base-200 transition-colors text-left"
            onClick={() => setOpen(open === t.id ? null : t.id)}
          >
            <ChevronRight className={cn("w-3.5 h-3.5 text-base-content/40 shrink-0 transition-transform", open === t.id && "rotate-90")} />
            <span className="text-xs text-base-content/40 font-mono w-16 shrink-0">{t.ts}</span>
            <span className="text-sm font-medium flex-1">{t.title}</span>
            <span className="text-xs text-base-content/40">{t.agent}</span>
            <span className="text-xs tabular text-base-content/40 w-12 text-right">{t.duration}</span>
            <span className={cn("badge badge-sm ml-2", TRACE_STATUS[t.status])}>{t.status}</span>
          </button>
          {open === t.id && (
            <div className="px-4 pb-4 pt-1 border-t border-base-200 space-y-3">
              <div className="flex gap-6 text-xs text-base-content/50">
                <span>Tokens: <span className="text-base-content font-mono">{t.tokens}</span></span>
                <span>Duration: <span className="text-base-content font-mono">{t.duration}</span></span>
                <span>Decision ID: <span className="text-base-content font-mono">{t.id}</span></span>
              </div>
              <div className="space-y-1.5">
                {[
                  { step: "Triage",      agent: "Orchestrator", tool: "—",                        ms: "120ms",  ok: true },
                  { step: "Investigate", agent: "Sentinel",     tool: "get_asset_sensor_window",  ms: "890ms",  ok: true },
                  { step: "Diagnose",    agent: "Sentinel",     tool: "search_manuals",           ms: "1,240ms", ok: true },
                  { step: "Plan window", agent: "Planner",      tool: "solve_schedule",           ms: "1,580ms", ok: true },
                  { step: "Stock check", agent: "Procurer",     tool: "get_spare_stock",          ms: "340ms",  ok: true },
                  { step: "Verify",      agent: "Critic",       tool: "check_evidence",           ms: "680ms",  ok: true },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-4 h-4 rounded-full bg-base-200 flex items-center justify-center text-[10px] text-base-content/40 shrink-0">{i + 1}</span>
                    <span className="text-base-content/60 w-24 shrink-0">{s.step}</span>
                    <span className="text-primary w-24 shrink-0">{s.agent}</span>
                    <span className="font-mono text-base-content/40 flex-1">{s.tool}</span>
                    <span className="tabular text-base-content/40 w-16 text-right">{s.ms}</span>
                    <CheckCircle className="w-3 h-3 text-success shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Evaluation Dashboard ───────────────────────────────────────────────────
const EVALS = [
  { component: "Visual Inspection",  metric: "Accuracy",          value: "87.4%", target: "≥ 85%", pass: true },
  { component: "Anomaly Detection",  metric: "Detection Delay",   value: "1m 42s", target: "< 2 min", pass: true },
  { component: "RUL Model",          metric: "P10–P90 Coverage",  value: "78.2%", target: "≥ 75%", pass: true },
  { component: "Demand Forecast",    metric: "MAPE vs naive",     value: "−22.1%", target: "≥ −15%", pass: true },
  { component: "NL→SQL",             metric: "Exec Accuracy",     value: "83.0%", target: "≥ 85%", pass: false },
  { component: "Agent Trajectories", metric: "Tool-call Correct", value: "88.5%", target: "≥ 85%", pass: true },
  { component: "Decision Briefs",    metric: "Claims Cited",      value: "100%",  target: "100%",  pass: true },
];

function EvalTab() {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr className="text-base-content/40 text-[11px] uppercase tracking-widest">
            <th>Component</th>
            <th>Metric</th>
            <th>Value</th>
            <th>Target</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {EVALS.map((e, i) => (
            <tr key={i} className="hover">
              <td className="text-sm font-medium">{e.component}</td>
              <td className="text-sm text-base-content/60">{e.metric}</td>
              <td className={cn("text-sm font-semibold tabular", e.pass ? "text-success" : "text-error")}>{e.value}</td>
              <td className="text-sm text-base-content/40 font-mono">{e.target}</td>
              <td>
                {e.pass
                  ? <span className="badge badge-success badge-sm badge-outline gap-1"><CheckCircle className="w-3 h-3" />Pass</span>
                  : <span className="badge badge-error badge-sm badge-outline gap-1"><AlertTriangle className="w-3 h-3" />Fail</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Connectors ─────────────────────────────────────────────────────────────
const CONNECTORS = [
  { name: "Factory Simulator",   type: "Internal",  status: "connected", detail: "60× demo mode · 360 sensors" },
  { name: "BigQuery Lakehouse",  type: "GCP",       status: "connected", detail: "asia-southeast1 · bronze/silver/gold/kg/ai" },
  { name: "Firestore",           type: "GCP",       status: "connected", detail: "Real-time UI state · 9 collections" },
  { name: "Pub/Sub",             type: "GCP",       status: "connected", detail: "9 topics · telemetry.raw BigQuery subscription" },
  { name: "Gemini Agent Platform", type: "GCP",     status: "connected", detail: "gemini-3.8-flash · global endpoint" },
  { name: "SAP S/4HANA",         type: "ERP",       status: "mock",      detail: "OData adapter · mock in MVP" },
  { name: "MES (OPC UA)",        type: "OT",        status: "mock",      detail: "Manufacturing Connect · roadmap" },
  { name: "Salesforce CRM",      type: "CRM",       status: "mock",      detail: "REST adapter · mock in MVP" },
  { name: "Weather API",         type: "Live Feed", status: "connected", detail: "Lane B · alerts every 15 min" },
  { name: "GDELT",               type: "Live Feed", status: "connected", detail: "Lane B · news every 15 min" },
];

const CONN_STATUS: Record<string, string> = {
  connected: "text-success",
  mock:      "text-warning",
  error:     "text-error",
};

function ConnectorsTab() {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr className="text-base-content/40 text-[11px] uppercase tracking-widest">
            <th>Connector</th>
            <th>Type</th>
            <th>Status</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {CONNECTORS.map((c, i) => (
            <tr key={i} className="hover">
              <td className="text-sm font-medium">{c.name}</td>
              <td><span className="badge badge-ghost badge-sm">{c.type}</span></td>
              <td>
                <span className={cn("flex items-center gap-1.5 text-xs font-medium", CONN_STATUS[c.status])}>
                  <span className={cn("w-1.5 h-1.5 rounded-full inline-block",
                    c.status === "connected" ? "bg-success" : c.status === "mock" ? "bg-warning" : "bg-error"
                  )} />
                  {c.status}
                </span>
              </td>
              <td className="text-xs text-base-content/40">{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Users & Roles ──────────────────────────────────────────────────────────
const USERS = [
  { name: "Priya Sharma",   role: "plant_manager",  plants: ["PNQ"],           last: "Now" },
  { name: "Kenji Tanaka",   role: "maintenance",    plants: ["PNQ","RYG","NGO"], last: "2m ago" },
  { name: "Arjun Mehta",    role: "technician",     plants: ["PNQ"],           last: "14m ago" },
  { name: "Mei Liang",      role: "quality",        plants: ["RYG"],           last: "1h ago" },
  { name: "Rahul Gupta",    role: "planner",        plants: ["PNQ","RYG"],     last: "32m ago" },
  { name: "Siti Rahmat",    role: "buyer",          plants: ["PNQ","RYG","NGO"], last: "3h ago" },
  { name: "Vikram Nair",    role: "coo",            plants: ["PNQ","RYG","NGO"], last: "Yesterday" },
];

function UsersTab() {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr className="text-base-content/40 text-[11px] uppercase tracking-widest">
            <th>Name</th>
            <th>Role</th>
            <th>Plants</th>
            <th>Last Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {USERS.map((u, i) => (
            <tr key={i} className="hover">
              <td>
                <div className="flex items-center gap-2.5">
                  <div className="avatar placeholder">
                    <div className="bg-primary/20 text-primary rounded-full w-7">
                      <span className="text-xs">{u.name[0]}</span>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{u.name}</span>
                </div>
              </td>
              <td><span className="badge badge-ghost badge-sm font-mono">{u.role}</span></td>
              <td>
                <div className="flex gap-1">
                  {u.plants.map((p) => <span key={p} className="badge badge-outline badge-xs">{p}</span>)}
                </div>
              </td>
              <td className="text-xs text-base-content/40">{u.last}</td>
              <td><button className="btn btn-ghost btn-xs">Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: "policies",    label: "Autonomy Policies", icon: Shield },
  { id: "agents",      label: "Agent Registry",    icon: Bot },
  { id: "traces",      label: "Trace Explorer",    icon: GitBranch },
  { id: "evals",       label: "Evaluations",       icon: BarChart2 },
  { id: "connectors",  label: "Connectors",        icon: Plug },
  { id: "users",       label: "Users & Roles",     icon: Users },
];

export default function AdminPage() {
  const [tab, setTab] = useState("policies");

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-base-content">Admin & Governance</h1>
          <p className="text-xs text-base-content/40 mt-0.5">Autonomy policies · agent registry · traces · evaluations · connectors · users</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-success">
            <Zap className="w-3.5 h-3.5" />All systems operational
          </span>
          <button className="btn btn-error btn-outline btn-sm">Pause All Autonomy</button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Agents",    value: "10",    sub: "2 idle",         icon: Bot,       color: "text-primary" },
          { label: "Decisions Today",  value: "38",    sub: "35 approved",    icon: CheckCircle, color: "text-success" },
          { label: "Avg Latency",      value: "3.1s",  sub: "p95 across all", icon: Clock,     color: "text-base-content" },
          { label: "Eval Pass Rate",   value: "85.7%", sub: "6/7 passing",    icon: BarChart2, color: "text-warning" },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <s.icon className={cn("w-5 h-5 shrink-0", s.color)} />
              <div>
                <p className={cn("text-xl font-semibold tabular", s.color)}>{s.value}</p>
                <p className="text-[10px] text-base-content/40 uppercase tracking-widest">{s.label}</p>
                <p className="text-[11px] text-base-content/40">{s.sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Card>
        <div role="tablist" className="tabs tabs-border mb-5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              className={cn("tab gap-2 text-sm", tab === id && "tab-active")}
              onClick={() => setTab(id)}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        {tab === "policies"   && <PoliciesTab />}
        {tab === "agents"     && <AgentsTab />}
        {tab === "traces"     && <TraceTab />}
        {tab === "evals"      && <EvalTab />}
        {tab === "connectors" && <ConnectorsTab />}
        {tab === "users"      && <UsersTab />}
      </Card>
    </div>
  );
}
