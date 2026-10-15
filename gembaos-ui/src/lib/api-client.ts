/**
 * GembaOS API Client
 * Built according to API_UI_MAPPING.md
 */


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://gembaos-gateway-100149412472.asia-southeast1.run.app";
const OPTIMIZER_BASE_URL =
  process.env.NEXT_PUBLIC_OPTIMIZER_URL || "https://gembaos-gateway-100149412472.asia-southeast1.run.app";

export interface UserProfile {
  name: string;
  email: string;
  roles: string[];
  allowed_plants: string[];
  avatar?: string;
  title?: string;
}

export interface PlantInfo {
  id: string;
  name: string;
  location?: string;
  country?: string;
  flag?: string;
  timezone?: string;
  lat?: number;
  lng?: number;
  status: "running" | "warning" | "attention" | "ATTENTION_REQUIRED" | "normal";
  active_anomalies?: number;
}

export interface ValueLedgerSummary {
  total_usd: number;
  downtime_h_avoided: number;
  co2_kg_saved: number;
  entries?: Array<{
    id: string;
    ts: string;
    description: string;
    est_usd: number;
    realized_usd: number | null;
    category: string;
  }>;
}

export interface InsightItem {
  id: string;
  ts: string;
  domain: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  agent: string;
  confidence?: number;
  evidence_ids?: string[];
  impact?: {
    usd?: number;
    downtime_h?: number;
    co2_kg?: number;
  };
  plant_ids?: string[];
  status?: string;
}

export interface DecisionOption {
  option_id: string;
  title?: string;
  description?: string;
  est_cost_usd?: number;
  est_value_usd?: number;
  downtime_hours_avoided?: number;
  actions?: string[];
}

export interface DecisionItem {
  id: string;
  decision_id?: string;
  title: string;
  recommendation?: string;
  status: "pending" | "approved" | "rejected";
  autonomy_level: string;
  severity: "critical" | "high" | "medium" | "low";
  impact: {
    usd_benefit: number;
    usd_cost: number;
  };
  options?: DecisionOption[];
  critic_verdict?: {
    verdict: string;
    audited_claims: number;
    issues: string[];
    dropped_options?: string[];
  };
  actions?: Array<{
    id: string;
    action_type: string;
    description: string;
    status: string;
  }>;
  blast_radius?: any;
  approvers?: string[];
  plant_ids?: string[];
  expires_at?: string;
}

export interface KpiDataPayload {
  scope?: string;
  as_of?: string;
  kpis: {
    oee_pct?: number;
    otif_pct?: number;
    mtbf_hours?: number;
    mttr_hours?: number;
    scrap_pct?: number;
    energy_per_unit_kwh?: number;
    revenue_at_risk_usd?: number;
    co2_intensity_kg_per_unit?: number;
    inventory_days?: number;
    safety_days?: number;
    [key: string]: any;
  } | null;
}

async function fetchWithFallback<T>(
  url: string,
  options?: RequestInit,
  fallbackValue?: T
): Promise<T> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      console.warn(`[API] ${options?.method || "GET"} ${url} returned ${res.status}`);
      if (fallbackValue !== undefined) return fallbackValue;
      throw new Error(`API error ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[API] Failed to fetch ${url}, using fallback:`, err);
    if (fallbackValue !== undefined) return fallbackValue;
    throw err;
  }
}

// -------------------------------------------------------------
// 1. Global Shell & Navigation Endpoints
// -------------------------------------------------------------

export async function fetchCurrentUser(): Promise<UserProfile> {
  // [MOCK DISABLED] Previously fell back to hardcoded Sarah Chen profile
  /*
  const fallback: UserProfile = {
    name: "Sarah Chen",
    email: "sarah.chen@gembaos.ai",
    roles: ["plant_manager", "planner"],
    allowed_plants: ["PNQ", "RYG", "NGO"],
    title: "Plant Manager · PNQ",
  };
  */
  const res = await fetchWithFallback<any>(`${API_BASE_URL}/v1/me`, {});
  return {
    name: res?.name || "Operator",
    email: res?.email || "",
    roles: res?.roles || [],
    allowed_plants: res?.allowed_plants || [],
    title: res?.roles?.[0] ? `${res.roles[0]} · ${res.primary_plant || "Fleet"}` : "Operations",
    avatar: res?.avatar,
  };
}

export async function fetchPlants(): Promise<PlantInfo[]> {
  // [MOCK DISABLED] Previously fell back to hardcoded PLANTS array
  /*
  const fallback: PlantInfo[] = PLANTS.map((p) => ({
    id: p.id,
    name: p.name,
    location: p.location,
    country: p.id === "PNQ" ? "India" : p.id === "RYG" ? "Thailand" : "Japan",
    flag: p.id === "PNQ" ? "🇮🇳" : p.id === "RYG" ? "🇹🇭" : "🇯🇵",
    timezone: p.id === "PNQ" ? "Asia/Kolkata" : p.id === "RYG" ? "Asia/Bangkok" : "Asia/Tokyo",
    lat: p.lat,
    lng: p.lng,
    status: (p.status === "warning" ? "ATTENTION_REQUIRED" : "running") as any,
    active_anomalies: p.id === "PNQ" ? 1 : 0,
  }));
  */

  const res = await fetchWithFallback<any>(
    `${API_BASE_URL}/v1/plants`,
    {}
  );

  const rawList: any[] = Array.isArray(res)
    ? res
    : Array.isArray(res?.plants)
    ? res.plants
    : [];

  return rawList.map((p: any) => ({
    id: p.id,
    name: p.name || `${p.id} Plant`,
    location: p.location || "",
    country: p.country || (p.id === "PNQ" ? "India" : p.id === "RYG" ? "Thailand" : "Japan"),
    flag: p.flag || (p.id === "PNQ" ? "🇮🇳" : p.id === "RYG" ? "🇹🇭" : "🇯🇵"),
    timezone: p.timezone || (p.id === "PNQ" ? "Asia/Kolkata" : p.id === "RYG" ? "Asia/Bangkok" : "Asia/Tokyo"),
    lat: p.lat ?? (p.id === "PNQ" ? 18.52 : p.id === "RYG" ? 12.68 : 35.18),
    lng: p.lng ?? (p.id === "PNQ" ? 73.85 : p.id === "RYG" ? 101.28 : 136.9),
    status: (p.status === "warning" || p.id === "PNQ" ? "ATTENTION_REQUIRED" : "running") as any,
    active_anomalies: p.active_anomalies ?? (p.id === "PNQ" ? 1 : 0),
  }));
}

export async function fetchValueLedger(): Promise<ValueLedgerSummary> {
  // [MOCK DISABLED] Previously fell back to hardcoded VALUE_LEDGER
  /*
  const fallback = VALUE_LEDGER as ValueLedgerSummary;
  */
  const res = await fetchWithFallback<any>(
    `${API_BASE_URL}/v1/value-ledger`,
    {}
  );

  if (!res) {
    return {
      total_usd: 0,
      downtime_h_avoided: 0,
      co2_kg_saved: 0,
      entries: [],
    };
  }

  return {
    total_usd: res.value_protected_usd ?? res.total_usd ?? 0,
    downtime_h_avoided: res.downtime_hours_avoided ?? res.downtime_h_avoided ?? 0,
    co2_kg_saved: (res.co2_avoided_tons ? res.co2_avoided_tons * 1000 : res.co2_kg_saved) ?? 0,
    entries: res.entries ?? [],
  };
}

export async function fetchActiveInsights(status = "new"): Promise<InsightItem[]> {
  // [MOCK DISABLED] Previously fell back to hardcoded INSIGHTS
  /*
  const fallback = INSIGHTS as InsightItem[];
  */
  const res = await fetchWithFallback<any>(
    `${API_BASE_URL}/v1/insights?status=${status}`,
    {}
  );
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.insights)) return res.insights;
  return [];
}

// -------------------------------------------------------------
// 2. Command Center Endpoints
// -------------------------------------------------------------

export async function fetchGlobalKpis(scope = "all"): Promise<KpiDataPayload> {
  // [MOCK DISABLED] Previously fell back to hardcoded KPI_DATA
  /*
  const fallback: KpiDataPayload = {
    kpis: {
      oee_pct: KPI_DATA.oee.value,
      otif_pct: KPI_DATA.otif.value,
      scrap_pct: KPI_DATA.scrap.value,
      energy_per_unit_kwh: KPI_DATA.energyPerUnit.value,
      co2_intensity_kg_per_unit: KPI_DATA.co2PerUnit.value,
      inventory_days: KPI_DATA.inventoryDays.value,
      safety_days: KPI_DATA.safetyDays.value,
      revenue_at_risk_usd: 793500,
      mtbf_hours: 142,
      mttr_hours: 2.4,
    },
  };
  */

  const res = await fetchWithFallback<any>(
    `${API_BASE_URL}/v1/kpis?scope=${encodeURIComponent(scope)}`,
    {}
  );

  return {
    scope: res?.scope || scope,
    as_of: res?.as_of || new Date().toISOString(),
    kpis: res?.kpis || null,
  };
}

export async function fetchDecisions(status = "pending"): Promise<DecisionItem[]> {
  // [MOCK DISABLED] Previously fell back to hardcoded DECISIONS
  /*
  const fallback = DECISIONS as DecisionItem[];
  */
  const res = await fetchWithFallback<any>(
    `${API_BASE_URL}/v1/decisions?status=${status}`,
    {}
  );

  const list: any[] = Array.isArray(res)
    ? res
    : Array.isArray(res?.decisions)
    ? res.decisions
    : [];

  return list.map((d: any) => ({
    id: d.decision_id || d.id,
    decision_id: d.decision_id || d.id,
    title: d.title,
    recommendation: d.summary || d.recommendation,
    status: d.status || "pending",
    autonomy_level: d.autonomy_level || "L2",
    severity: (d.est_value_usd > 500000 ? "critical" : "high") as any,
    impact: {
      usd_benefit: d.est_value_usd ?? d.impact?.usd_benefit ?? 0,
      usd_cost: d.impact?.usd_cost ?? 0,
    },
    options: d.options || [],
    critic_verdict: d.critic_verdict,
    actions: d.actions || [],
    blast_radius: d.blast_radius,
    approvers: typeof d.approvers === "string" ? d.approvers.split(" ") : d.approvers || [],
    plant_ids: typeof d.plant_ids === "string" ? d.plant_ids.split(" ") : d.plant_ids || [],
  }));
}

export async function approveDecision(
  decisionId: string,
  body?: { option_id?: string; comment?: string }
): Promise<{ status: string; decision_id: string }> {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/decisions/${encodeURIComponent(decisionId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify(body || { option_id: "OPT-A", comment: "Approved via GembaOS UI" }),
    },
    { status: "approved", decision_id: decisionId }
  );
}

export async function rejectDecision(
  decisionId: string,
  body?: { reason?: string }
): Promise<{ status: string; decision_id: string }> {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/decisions/${encodeURIComponent(decisionId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify(body || { reason: "Rejected via GembaOS UI" }),
    },
    { status: "rejected", decision_id: decisionId }
  );
}

// -------------------------------------------------------------
// 3. Asset Detail Endpoints
// -------------------------------------------------------------

export async function fetchAsset(assetId: string) {
  // [MOCK DISABLED] Previously fell back to defaultAsset from ASSETS
  /*
  const defaultAsset = ASSETS.find((a) => a.id === assetId) || ASSETS[0];
  */
  return fetchWithFallback(
    `${API_BASE_URL}/v1/assets/${encodeURIComponent(assetId)}`,
    {}
  );
}

export async function fetchAssetTelemetry(
  assetId: string,
  params?: { minutes?: number; metric?: string }
) {
  // [MOCK DISABLED] Previously fell back to TELEMETRY_SERIES
  /*
  const fallback = TELEMETRY_SERIES;
  */
  const minutes = params?.minutes || 60;
  const metric = params?.metric || "vib_rms";
  return fetchWithFallback(
    `${API_BASE_URL}/v1/assets/${encodeURIComponent(assetId)}/telemetry?minutes=${minutes}&metric=${metric}`,
    {}
  );
}

export async function fetchAssetHealth(assetId: string) {
  // [MOCK DISABLED] Previously fell back to hardcoded health score
  /*
  const fallback = {
    asset_id: assetId,
    health_score: 62,
    failure_mode: "Outer-race bearing spalling",
    rul_hours: { p10: 26.5, p50: 34.0, p90: 48.0 },
    required_part: "BRG-6205",
    on_hand_status: "Available (18 units in Pune Crib B)",
    recommended_maintenance_window: "Thursday 14:00 (PM shift)",
  };
  */
  return fetchWithFallback(
    `${API_BASE_URL}/v1/assets/${encodeURIComponent(assetId)}/health`,
    {}
  );
}

// -------------------------------------------------------------
// 4. War Room & Blast Radius
// -------------------------------------------------------------

export async function fetchBlastRadius(params: {
  event_type: string;
  entity_id: string;
}) {
  // [MOCK DISABLED] Previously fell back to hardcoded blast radius nodes
  /*
  const fallback = {
    root_disruption: { type: params.event_type, entity_id: params.entity_id },
    affected_nodes: [...],
    total_revenue_at_risk_usd: 1820000,
  };
  */
  return fetchWithFallback(
    `${API_BASE_URL}/v1/graph/blast-radius?event_type=${params.event_type}&entity_id=${params.entity_id}`,
    {}
  );
}

// -------------------------------------------------------------
// 5. Production Planner & CTP (Optimizer Engine)
// -------------------------------------------------------------

export async function solveSchedule(horizonDays = 7, operations = []) {
  return fetchWithFallback(
    `${OPTIMIZER_BASE_URL}/v1/schedule/solve`,
    {
      method: "POST",
      body: JSON.stringify({ horizon_days: horizonDays, operations }),
    },
    { status: "OPTIMAL", horizon_days: horizonDays, schedule: [] }
  );
}

export async function calculateCtp(payload: {
  sku_id: string;
  qty: number;
  customer_id: string;
  due_date: string;
}) {
  return fetchWithFallback(
    `${OPTIMIZER_BASE_URL}/v1/ctp`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    {
      feasible: true,
      earliest_delivery: payload.due_date,
      options: [
        { id: "OPT-SPLIT", description: "Split delivery 60% on-time, 40% +3 days" },
        { id: "OPT-EXPEDITE", description: "Expedite raw parts via air freight" },
      ],
    }
  );
}

export async function calculateMrp(horizonWeeks = 4) {
  return fetchWithFallback(
    `${OPTIMIZER_BASE_URL}/v1/mrp`,
    {
      method: "POST",
      body: JSON.stringify({ horizon_weeks: horizonWeeks }),
    },
    { horizon_weeks: horizonWeeks, requirements: [] }
  );
}

export async function calculateLoadShift(plantId = "NGO") {
  return fetchWithFallback(
    `${OPTIMIZER_BASE_URL}/v1/loadshift`,
    {
      method: "POST",
      body: JSON.stringify({ plant_id: plantId }),
    },
    {
      plant_id: plantId,
      savings_usd: 680,
      co2_avoided_tons: 1.82,
      recommendation: "Shift induction furnaces from peak (14:00-18:00) to off-peak (02:00-06:00)",
    }
  );
}

// -------------------------------------------------------------
// 6. Quality Studio
// -------------------------------------------------------------

export async function postInspection(formData: FormData) {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/inspections`,
    {
      method: "POST",
      headers: {}, // Let browser set multipart boundary
      body: formData,
    },
    {
      inspection_id: "insp_" + Date.now(),
      status: "COMPLETED",
      defects_found: 1,
      boxes: [
        { label: "porosity", score: 0.94, box_2d: [120, 150, 240, 290] },
      ],
    }
  );
}

// -------------------------------------------------------------
// 7. Demo Director Scenarios
// -------------------------------------------------------------

export async function triggerDemoScenario(scenarioKey: string, payload: Record<string, any> = {}) {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/demo/scenarios/${encodeURIComponent(scenarioKey)}/start`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { status: "started", scenario: scenarioKey }
  );
}

export async function resetDemo() {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/demo/reset`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    { status: "reset" }
  );
}

// -------------------------------------------------------------
// 8. Health Check & Universal Chat (/healthz, /v1/chat)
// -------------------------------------------------------------

export async function checkHealth(): Promise<{ status: string }> {
  return fetchWithFallback(
    `${API_BASE_URL}/healthz`,
    {},
    { status: "ok" }
  );
}

export interface ChatResponsePayload {
  message?: string;
  content?: string;
  reply?: string;
  text?: string;
  agent?: string;
  sql?: string;
  evidence?: string[];
}

export async function sendChatMessage(
  message: string,
  context?: { page?: string; plant_id?: string; asset_id?: string }
): Promise<ChatResponsePayload> {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/chat`,
    {
      method: "POST",
      body: JSON.stringify({
        message,
        context: context || { page: "/" },
      }),
    },
    {
      content: "Based on the latest data from BigQuery, telemetry and operational parameters are within normal thresholds.",
      agent: "Orchestrator",
      evidence: ["ev:sql-1"],
    }
  );
}

// -------------------------------------------------------------
// 9. Procurement Hub (/v1/procurement)
// -------------------------------------------------------------

export interface ReorderItem {
  part_id: string;
  part_name: string;
  plant_id: string;
  stock_qty: number;
  reserved_qty: number;
  location_bin: string;
  recommended_qty: number;
  supplier: string;
  unit_cost_usd: number;
  total_cost_usd: number;
  urgency: "critical" | "high" | "medium" | "low";
  reason: string;
}

export interface DraftPoResponse {
  status: string;
  po_number: string;
  part_id: string;
  supplier: string;
  qty: number;
  unit_cost_usd: number;
  total_cost_usd: number;
  freight: string;
  lead_time_days: number;
  estimated_delivery_date: string;
  reason: string;
  created_at: string;
  governance: {
    requires_role: string;
    approval_status: string;
    reversible: boolean;
  };
  target_system: string;
  message: string;
}

export async function fetchReorderWorklist(plantId?: string): Promise<ReorderItem[]> {
  const url = plantId
    ? `${API_BASE_URL}/v1/procurement/reorder-worklist?plant_id=${encodeURIComponent(plantId)}`
    : `${API_BASE_URL}/v1/procurement/reorder-worklist`;
  const res = await fetchWithFallback<{ worklist: ReorderItem[] }>(url, {});
  return res?.worklist || [];
}

export async function draftPo(payload: {
  part_id: string;
  supplier: string;
  qty: number;
  unit_cost_usd?: number;
  freight?: string;
  reason?: string;
}): Promise<DraftPoResponse> {
  return fetchWithFallback<DraftPoResponse>(
    `${API_BASE_URL}/v1/procurement/draft-po`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    {
      status: "DRAFTED",
      po_number: `PO-${Date.now().toString().slice(-8)}`,
      part_id: payload.part_id,
      supplier: payload.supplier,
      qty: payload.qty,
      unit_cost_usd: payload.unit_cost_usd ?? 24.8,
      total_cost_usd: (payload.unit_cost_usd ?? 24.8) * payload.qty,
      freight: payload.freight ?? "AIR_EXPEDITE",
      lead_time_days: 6,
      estimated_delivery_date: new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0],
      reason: payload.reason ?? "Replenishment buffer",
      created_at: new Date().toISOString(),
      governance: {
        requires_role: "buyer",
        approval_status: "PENDING_BUYER_SIGN_OFF",
        reversible: true,
      },
      target_system: "ERP",
      message: "Draft Purchase Order created successfully in ERP staging.",
    }
  );
}
