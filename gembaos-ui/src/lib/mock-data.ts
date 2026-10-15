// Mock data for GembaOS demo

export const PLANTS = [
  { id: "PNQ", name: "Pune Plant", location: "Pune, India", lat: 18.52, lng: 73.85, status: "warning" },
  { id: "RYG", name: "Rayong Plant", location: "Rayong, Thailand", lat: 12.68, lng: 101.28, status: "running" },
  { id: "NGO", name: "Nagoya Plant", location: "Nagoya, Japan", lat: 35.18, lng: 136.9, status: "running" },
];

export const KPI_DATA = {
  oee: { value: 78.4, delta: -2.1, unit: "%" },
  otif: { value: 94.2, delta: 0.3, unit: "%" },
  scrap: { value: 2.8, delta: 0.4, unit: "%" },
  energyPerUnit: { value: 4.1, delta: -0.2, unit: "kWh" },
  co2PerUnit: { value: 1.9, delta: -0.1, unit: "kg" },
  inventoryDays: { value: 23, delta: -1, unit: "d" },
  safetyDays: { value: 142, delta: 1, unit: "d" },
  valueLedger: { value: 2410000, delta: 180000, unit: "USD" },
};

export const ASSETS = [
  { id: "PNQ-CNC-07", name: "CNC Mill 07", plant: "PNQ", line: "L1", type: "CNC", health: 42, state: "warning", rul: 68, rulP10: 41, rulP90: 96 },
  { id: "PNQ-CNC-03", name: "CNC Mill 03", plant: "PNQ", line: "L1", type: "CNC", health: 87, state: "running", rul: 320, rulP10: 280, rulP90: 380 },
  { id: "PNQ-ROB-01", name: "Robotic Welder 01", plant: "PNQ", line: "L2", type: "Robot", health: 91, state: "running", rul: 450, rulP10: 400, rulP90: 510 },
  { id: "RYG-DCM-02", name: "Die Cast Machine 02", plant: "RYG", line: "L1", type: "DieCast", health: 63, state: "warning", rul: 120, rulP10: 90, rulP90: 160 },
  { id: "RYG-DCM-04", name: "Die Cast Machine 04", plant: "RYG", line: "L1", type: "DieCast", health: 79, state: "running", rul: 280, rulP10: 240, rulP90: 330 },
  { id: "NGO-FUR-02", name: "Heat Treat Furnace 02", plant: "NGO", line: "L3", type: "Furnace", health: 95, state: "running", rul: 600, rulP10: 550, rulP90: 680 },
  { id: "NGO-GRD-01", name: "Gear Grinder 01", plant: "NGO", line: "L2", type: "Grinder", health: 88, state: "running", rul: 390, rulP10: 350, rulP90: 440 },
  { id: "PNQ-CMP-01", name: "Air Compressor 01", plant: "PNQ", line: "UTIL", type: "Compressor", health: 72, state: "idle", rul: 200, rulP10: 160, rulP90: 250 },
];

export const INSIGHTS = [
  {
    id: "ins_001", ts: "2026-10-15T07:12:00Z", domain: "maintenance", severity: "critical",
    title: "CNC-07 outer-race bearing fault detected",
    summary: "Vibration RMS 3.2× baseline; BPFO frequency confirmed. RUL P50 = 68 h (P10 = 41 h). Maintenance window Thu 14:00 recommended.",
    agent: "Sentinel", confidence: 0.91, impact: { usd: 180000, downtime_h: 3, co2_kg: 0 },
    plant_ids: ["PNQ"], status: "new",
  },
  {
    id: "ins_002", ts: "2026-10-15T06:48:00Z", domain: "supply", severity: "high",
    title: "Typhoon Haikui-2 threatens Hsinchu semiconductor supply",
    summary: "Typhoon p=0.8 landfall in 48 h. 2 parts from Formosa Semicon affect 3 SKUs, 11 open orders, $1.82M revenue at risk. Stock-out in 9 days.",
    agent: "Scout", confidence: 0.80, impact: { usd: 1820000, downtime_h: 0, co2_kg: 0 },
    plant_ids: ["PNQ"], status: "new",
  },
  {
    id: "ins_003", ts: "2026-10-15T05:30:00Z", domain: "quality", severity: "medium",
    title: "Casting porosity trend rising at Rayong DCM-02",
    summary: "Die temperature drifted −18 °C over 4 h. Porosity defect rate up 2.1 pp on lot L-4471. Shot-sleeve maintenance overdue.",
    agent: "Inspector", confidence: 0.87, impact: { usd: 24000, downtime_h: 0, co2_kg: 0 },
    plant_ids: ["RYG"], status: "new",
  },
  {
    id: "ins_004", ts: "2026-10-15T04:15:00Z", domain: "energy", severity: "low",
    title: "Load-shift opportunity: furnace pre-heat to off-peak window",
    summary: "Moving NGO furnace pre-heat to 02:00–05:00 saves $3.1k and 4.6 tCO₂e/month.",
    agent: "Verdant", confidence: 0.94, impact: { usd: 3100, downtime_h: 0, co2_kg: -4600 },
    plant_ids: ["NGO"], status: "new",
  },
];

export const DECISIONS = [
  {
    id: "dec_001", title: "War Room: Typhoon Haikui-2 supply response",
    recommendation: "Option B: Split-source Penang + pull-ahead 2 days",
    status: "pending", autonomy_level: "L2", severity: "high",
    impact: { usd_benefit: 1820000, usd_cost: 64000 },
    approvers: ["plant_manager"], plant_ids: ["PNQ"],
    expires_at: "2026-10-15T12:00:00Z",
  },
  {
    id: "dec_002", title: "CNC-07 bearing replacement — Thu 14:00",
    recommendation: "Schedule 3h maintenance window, reserve bearing 6205 ×1",
    status: "pending", autonomy_level: "L2", severity: "critical",
    impact: { usd_benefit: 180000, usd_cost: 1200 },
    approvers: ["maintenance"], plant_ids: ["PNQ"],
    expires_at: "2026-10-15T10:00:00Z",
  },
  {
    id: "dec_003", title: "Reorder bearings 6205 ×20 — Pune stores",
    recommendation: "Auto-PO to NSK Japan, $840, preferred supplier",
    status: "pending", autonomy_level: "L3", severity: "low",
    impact: { usd_benefit: 0, usd_cost: 840 },
    approvers: ["buyer"], plant_ids: ["PNQ"],
    expires_at: "2026-10-16T08:00:00Z",
  },
];

export const WAR_ROOM_MESSAGES = [
  { id: "m1", agent: "Scout", icon: "🛰", color: "#38BDF8", ts: "07:13:02", text: "Typhoon Haikui-2 detected. Landfall probability 0.80 in 48 h near Hsinchu, Taiwan. Source: Weather API alert + GDELT.", evidence: ["ev_feed_3", "ev_feed_7"], isScenario: true },
  { id: "m2", agent: "Navigator", icon: "🧭", color: "#06B6D4", ts: "07:13:08", text: "Blast radius computed: Formosa Semicon → 2 parts (gate-driver IC, current-sensor IC) → 3 SKUs → 11 open orders → 2 customers. Revenue at risk: $1.82M. Stock-out in 9 days.", evidence: ["ev_gql_1"] },
  { id: "m3", agent: "Procurer", icon: "🤝", color: "#22C55E", ts: "07:13:22", text: "Alternate supplier found: Penang Micro (qualified, share_pct=0). Lead time 6 days, +8% unit cost, air freight available. Estimated premium: $64k.", evidence: ["ev_sql_4", "ev_doc_2"] },
  { id: "m4", agent: "Planner", icon: "📅", color: "#3B82F6", ts: "07:13:35", text: "Pull-ahead feasible: 2 days of production re-sequenced at PNQ. 0.3 pp OTIF impact. 2 shifts OT required.", evidence: ["ev_opt_1"] },
  { id: "m5", agent: "Oracle", icon: "🔮", color: "#8B5CF6", ts: "07:13:48", text: "Kirin Mobility orders are critical — penalty clause active. Prioritise CUST-KIRIN in all options.", evidence: ["ev_sql_8"] },
  { id: "m6", agent: "Ledger", icon: "💰", color: "#F59E0B", ts: "07:14:01", text: "Impact table computed. Option A: air freight only, $142k cost, OTIF −0.0pp. Option B: split-source + pull-ahead, $64k cost, OTIF −0.3pp. Option C: defer + expedite, $210k cost.", evidence: ["ev_sql_9"] },
  { id: "m7", agent: "Critic", icon: "⚖", color: "#9CA3AF", ts: "07:14:18", text: "Option C infeasible — PNQ-L2 at 97% capacity, cannot absorb NGO split. Options A and B verified. All claims have evidence. Recommending Option B.", evidence: ["ev_opt_2"] },
];

export const TELEMETRY_SERIES = Array.from({ length: 60 }, (_, i) => ({
  ts: new Date(Date.now() - (59 - i) * 60000).toISOString(),
  vib_rms: 0.8 + Math.sin(i * 0.3) * 0.1 + (i > 45 ? (i - 45) * 0.08 : 0) + Math.random() * 0.05,
  temp_c: 42 + Math.sin(i * 0.2) * 2 + (i > 45 ? (i - 45) * 0.3 : 0) + Math.random() * 0.5,
  current_a: 18 + Math.sin(i * 0.15) * 1 + Math.random() * 0.3,
}));

export const DEFECT_IMAGES = [
  { id: "img_001", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:12:00Z", is_defect: true, defect_type: "porosity", severity: "high", confidence: 0.91, plant: "RYG" },
  { id: "img_002", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:14:00Z", is_defect: true, defect_type: "porosity", severity: "medium", confidence: 0.84, plant: "RYG" },
  { id: "img_003", lot: "L-4470", sku: "HSG-220", ts: "2026-10-15T04:50:00Z", is_defect: false, defect_type: null, severity: null, confidence: 0.97, plant: "RYG" },
  { id: "img_004", lot: "L-4471", sku: "HSG-220", ts: "2026-10-15T05:18:00Z", is_defect: true, defect_type: "cold_shut", severity: "low", confidence: 0.76, plant: "RYG" },
  { id: "img_005", lot: "L-4472", sku: "HSG-220", ts: "2026-10-15T05:45:00Z", is_defect: false, defect_type: null, severity: null, confidence: 0.99, plant: "RYG" },
  { id: "img_006", lot: "L-4472", sku: "HSG-220", ts: "2026-10-15T05:47:00Z", is_defect: true, defect_type: "flash", severity: "low", confidence: 0.82, plant: "RYG" },
];

export const SUPPLIERS = [
  { id: "SUP-FORMOSA", name: "Formosa Semicon", country: "Taiwan", city: "Hsinchu", risk_score: 8.2, otd_pct: 94, ppm: 120, tier: 1, status: "critical" },
  { id: "SUP-PENANG", name: "Penang Micro", country: "Malaysia", city: "Penang", risk_score: 3.1, otd_pct: 97, ppm: 45, tier: 1, status: "ok" },
  { id: "SUP-NSK", name: "NSK Japan", country: "Japan", city: "Tokyo", risk_score: 1.8, otd_pct: 99, ppm: 12, tier: 1, status: "ok" },
  { id: "SUP-BAOTOU", name: "Baotou Magnetics", country: "China", city: "Baotou", risk_score: 5.4, otd_pct: 91, ppm: 280, tier: 2, status: "warn" },
  { id: "SUP-VIET", name: "Hanoi Copper Wire", country: "Vietnam", city: "Hanoi", risk_score: 2.9, otd_pct: 96, ppm: 65, tier: 2, status: "ok" },
];

export const FORECAST_DATA = Array.from({ length: 90 }, (_, i) => {
  const base = 4200 + Math.sin(i * 0.15) * 400 + i * 8;
  return {
    day: new Date(Date.now() + i * 86400000).toISOString().split("T")[0],
    forecast: Math.round(base),
    lower: Math.round(base * 0.88),
    upper: Math.round(base * 1.12),
    actual: i < 7 ? Math.round(base + (Math.random() - 0.5) * 200) : null,
  };
});

export const GANTT_JOBS = [
  { id: "J001", sku: "TM-300", machine: "PNQ-CNC-07", start: 0, duration: 4, color: "#3B82F6", customer: "Kirin" },
  { id: "J002", sku: "TM-300", machine: "PNQ-CNC-03", start: 2, duration: 6, color: "#3B82F6", customer: "Kirin" },
  { id: "J003", sku: "HSG-220", machine: "RYG-DCM-02", start: 0, duration: 8, color: "#8B5CF6", customer: "Zenith" },
  { id: "J004", sku: "GBX-100", machine: "NGO-GRD-01", start: 1, duration: 5, color: "#22C55E", customer: "Arka" },
  { id: "J005", sku: "TM-300", machine: "PNQ-CNC-07", start: 5, duration: 3, color: "#3B82F6", customer: "Zenith" },
  { id: "J006", sku: "GBX-100", machine: "NGO-FUR-02", start: 3, duration: 7, color: "#22C55E", customer: "Siam" },
];

export const VALUE_LEDGER = {
  total_usd: 2410000,
  downtime_h_avoided: 31,
  co2_kg_saved: 18200,
  entries: [
    { id: "vl_001", ts: "2026-10-14T14:00:00Z", description: "CNC-05 bearing replacement (proactive)", est_usd: 145000, realized_usd: 138000, category: "maintenance" },
    { id: "vl_002", ts: "2026-10-13T09:00:00Z", description: "Demand sensing: Zenith order +8%", est_usd: 320000, realized_usd: null, category: "demand" },
    { id: "vl_003", ts: "2026-10-12T11:00:00Z", description: "Porosity containment lot L-4460", est_usd: 28000, realized_usd: 24000, category: "quality" },
    { id: "vl_004", ts: "2026-10-11T16:00:00Z", description: "Load shift NGO furnace Oct", est_usd: 3100, realized_usd: null, category: "energy" },
  ],
};
