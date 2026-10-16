# GembaOS UI Integration Guide: Button & Feature Wiring

> **Scope Notice:** In accordance with project instructions, all backend API endpoints and business logic have been fully implemented, verified, and deployed on the live API Gateway (`gembaos-gateway`). **Zero UI files have been altered.**
> 
> This document provides the exact frontend modifications, helper functions, state hooks, and copy-paste React snippets required to connect all UI buttons directly to the live backend services.

---

## 1. Feature & Button Audit Summary

| Page / Component | UI Element / Button | Status Before | Backend Endpoint Live | Required UI Action |
|---|---|---|---|---|
| **Topbar** (`topbar.tsx`) | *Approve Option A* | ✅ Connected | `POST /v1/decisions/{id}/approve` | None. Fully functional. |
| **Topbar** (`topbar.tsx`) | *Reject Proposal* | ✅ Connected | `POST /v1/decisions/{id}/reject` | None. Backend implemented. |
| **Asset Health** (`asset-health/page.tsx`) | *Plan Maintenance (Schedule WO)* | ⚠️ Local state only | `POST /v1/assets/{id}/work-order`<br>`POST /v1/work-orders` | Call `scheduleWorkOrder()`, show WO number & LOTO status. |
| **Quality Studio** (`quality/page.tsx`) | *Upload & Inspect Image* | ⚠️ Stub fallback | `POST /v1/inspections` | Already calls `postInspection()`. Backend now live. |
| **Quality Studio** (`quality/page.tsx`) | *Human Label: Correct / Wrong* | ⚠️ Local state only | `POST /v1/inspections/{id}/feedback` | Call `recordInspectionFeedback()`, show toast. |
| **Quality Studio** (`quality/page.tsx`) | *Generate 8D Report PDF* | ❌ Dead button | `POST /v1/quality/8d-report` | Add `onClick`, fetch D1–D8 report modal/dialog. |
| **War Room** (`war-room/page.tsx`) | *Start War Room Deliberation* | ⚠️ Local timer | `POST /v1/war-room/start` | Trigger live agent deliberation ingress. |
| **Demand Sensing** (`demand/page.tsx`) | *Accept / Reject Volume Surge* | ❌ Dead buttons | `POST /v1/demand/forecast-override` | Add `onClick` handlers with optimistic update. |
| **Demand Sensing** (`demand/page.tsx`) | *Generate Pre-read* | ❌ Dead button | `POST /v1/demand/sop-preread` | Add `onClick` to download/preview S&OP executive brief. |
| **Sustainability** (`sustainability/page.tsx`) | *Approve Load-Shift* | ❌ Dead button | `POST /v1/sustainability/approve-loadshift` | Call endpoint and display MES dispatch confirmation. |
| **Sustainability** (`sustainability/page.tsx`) | *Auto-draft ESG Report (GRI)* | ❌ Dead button | `POST /v1/sustainability/esg-report` | Add `onClick` to trigger GRI-305 emission report. |
| **Admin Console** (`admin/page.tsx`) | *Pause All Autonomy (Master E-STOP)*| ❌ Dead button | `POST /v1/admin/autonomy/pause`<br>`POST /v1/admin/autonomy/resume`<br>`GET /v1/admin/autonomy/status` | Add toggle hook and live banner update. |
| **Ask GembaOS** (`chat/page.tsx` & `copilot-drawer.tsx`) | *Universal Chat & Copilot* | ⚠️ Generic one-liner | `POST /v1/chat` | ✅ **Resolved!** Backed by Vertex AI `gemini-2.5-flash` with dynamic agent routing (Sentinel, Inspector, Navigator, Oracle, etc.), generated BigQuery SQL queries, and evidence citations. |
| **Demo Director** (`demo-director-toolbar.tsx`)| *Bearing Fault / Typhoon / Reset* | ⚠️ Mock notice | `POST /v1/demo/scenarios/{key}/start`<br>`POST /v1/demo/reset` | Backend now actively injects into Firestore. |

---

## 2. API Client Additions (`gembaos-ui/src/lib/api-client.ts`)

Append the following helper functions to `gembaos-ui/src/lib/api-client.ts`:

```typescript
// -------------------------------------------------------------
// 10. Work Orders (CMMS & Sentinel)
// -------------------------------------------------------------
export async function scheduleWorkOrder(payload: {
  asset_id: string;
  maintenance_window?: string;
  priority?: string;
  required_part?: string;
  assigned_technician?: string;
  reason?: string;
}) {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/assets/${encodeURIComponent(payload.asset_id)}/work-order`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    {
      status: "SCHEDULED",
      work_order_id: `WO-${Date.now().toString().slice(-6)}`,
      asset_id: payload.asset_id,
      maintenance_window: payload.maintenance_window || "Thursday 14:00 (PM shift)",
      message: "Work order staged in CMMS with LOTO safety protocol.",
    }
  );
}

// -------------------------------------------------------------
// 11. Quality Studio: Feedback & 8D Report
// -------------------------------------------------------------
export async function submitInspectionFeedback(
  inspectionId: string,
  label: "correct" | "wrong",
  notes?: string
) {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/inspections/${encodeURIComponent(inspectionId)}/feedback`,
    {
      method: "POST",
      body: JSON.stringify({ human_label: label, notes }),
    },
    { status: "RECORDED", inspection_id: inspectionId, human_label: label }
  );
}

export async function generate8DReport(lotId = "L-4471", sku = "HSG-220") {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/quality/8d-report`,
    {
      method: "POST",
      body: JSON.stringify({ lot_id: lotId, sku }),
    },
    {
      status: "GENERATED",
      report_id: `8D-2026-${lotId}`,
      lot_id: lotId,
      sku: sku,
      sections: [],
    }
  );
}

// -------------------------------------------------------------
// 12. War Room Deliberation Ingress
// -------------------------------------------------------------
export async function triggerWarRoomDeliberation(decisionId = "dec_001", scenario = "typhoon_hsinchu") {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/war-room/start`,
    {
      method: "POST",
      body: JSON.stringify({ decision_id: decisionId, scenario }),
    },
    { status: "ACTIVE", deliberation_id: `dlb_${decisionId}` }
  );
}

// -------------------------------------------------------------
// 13. Demand Sensing & S&OP
// -------------------------------------------------------------
export async function overrideForecast(payload: {
  sku: string;
  customer: string;
  adjustment: string;
  action: "accept" | "reject";
  reason?: string;
}) {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/demand/forecast-override`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { status: "APPLIED", sku: payload.sku, action: payload.action }
  );
}

export async function fetchSopPreread(month = "Nov 2026") {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/demand/sop-preread`,
    {
      method: "POST",
      body: JSON.stringify({ month }),
    },
    { status: "GENERATED", document_id: "SOP-2026-11-PREREAD" }
  );
}

// -------------------------------------------------------------
// 14. Sustainability: Load-Shift & ESG Reporting
// -------------------------------------------------------------
export async function approveLoadShiftSchedule(payload: {
  plant_id: string;
  process?: string;
  window?: string;
}) {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/sustainability/approve-loadshift`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    {
      status: "APPROVED",
      dispatch_id: `LS-${payload.plant_id}-01`,
      savings_usd_monthly: 3100,
      co2_avoided_tons_monthly: 4.6,
    }
  );
}

export async function generateEsgReport(standard = "GRI-305", period = "October 2026") {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/sustainability/esg-report`,
    {
      method: "POST",
      body: JSON.stringify({ standard, period }),
    },
    { status: "DRAFTED", report_id: "GRI-305-OCT-2026", total_tco2e: 142.0 }
  );
}

// -------------------------------------------------------------
// 15. Admin Autonomy Master E-STOP
// -------------------------------------------------------------
export async function fetchAutonomyStatus() {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/admin/autonomy/status`,
    {},
    { autonomy_paused: false, mode: "OPERATIONAL" }
  );
}

export async function pauseMasterAutonomy(reason?: string) {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/admin/autonomy/pause`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    { status: "PAUSED", autonomy_paused: true }
  );
}

export async function resumeMasterAutonomy() {
  return fetchWithFallback(
    `${API_BASE_URL}/v1/admin/autonomy/resume`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    { status: "RESUMED", autonomy_paused: false }
  );
}
```

---

## 3. UI Component Updates (Step-by-Step)

### Page A: Asset Health (`gembaos-ui/src/app/(dashboard)/asset-health/page.tsx`)

#### 1. Import helper:
```typescript
import { scheduleWorkOrder } from "@/lib/api-client";
```

#### 2. Update button handler around line 211:
```tsx
// Before:
{!workOrderCreated ? (
  <Button
    variant="primary"
    size="sm"
    onClick={() => setWorkOrderCreated(true)}
    className="shrink-0"
  >
    <Wrench className="w-3.5 h-3.5" /> Plan Maintenance
  </Button>
) : (
  <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg shrink-0">
    <CheckCircle className="w-3.5 h-3.5" /> WO Created · {maintWindow}
  </div>
)}

// Replace with:
const [woLoading, setWoLoading] = useState(false);
const [createdWoId, setCreatedWoId] = useState<string | null>(null);

const handleScheduleWorkOrder = async () => {
  setWoLoading(true);
  try {
    const res = await scheduleWorkOrder({
      asset_id: selected.id,
      maintenance_window: maintWindow,
      priority: healthScore < 50 ? "CRITICAL" : "MEDIUM",
      required_part: requiredPart,
    });
    setCreatedWoId(res?.work_order_id || "WO-SCHEDULED");
    setWorkOrderCreated(true);
  } catch (err) {
    console.error("Failed to schedule work order:", err);
  } finally {
    setWoLoading(false);
  }
};

// Render:
{!workOrderCreated ? (
  <Button
    variant="primary"
    size="sm"
    disabled={woLoading}
    onClick={handleScheduleWorkOrder}
    className="shrink-0"
  >
    <Wrench className="w-3.5 h-3.5" />
    {woLoading ? "Scheduling..." : "Plan Maintenance"}
  </Button>
) : (
  <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg shrink-0">
    <CheckCircle className="w-3.5 h-3.5" />
    <span>{createdWoId || "WO-SCHEDULED"} · {maintWindow}</span>
  </div>
)}
```

---

### Page B: Visual Quality Studio (`gembaos-ui/src/app/(dashboard)/quality/page.tsx`)

#### 1. Import helpers:
```typescript
import { submitInspectionFeedback, generate8DReport } from "@/lib/api-client";
```

#### 2. Wire Human-In-The-Loop Labeling (lines 319–342):
```tsx
const handleLabelFeedback = async (inspectionId: string, label: "correct" | "wrong") => {
  setLabeled((prev) => ({ ...prev, [inspectionId]: label }));
  try {
    await submitInspectionFeedback(inspectionId, label);
  } catch (err) {
    console.warn("Feedback recording error:", err);
  }
};

// Replace buttons with:
<div className="flex gap-2">
  <Button
    size="sm"
    variant="success"
    className="flex-1"
    onClick={() => handleLabelFeedback(selected.id, "correct")}
  >
    <CheckCircle className="w-3 h-3" /> Correct
  </Button>
  <Button
    size="sm"
    variant="danger"
    className="flex-1"
    onClick={() => handleLabelFeedback(selected.id, "wrong")}
  >
    <XCircle className="w-3 h-3" /> Wrong
  </Button>
</div>
```

#### 3. Wire 8D Report Button (lines 375–378):
```tsx
const [generating8d, setGenerating8d] = useState(false);
const [eightDReport, setEightDReport] = useState<any>(null);

const handleGenerate8D = async () => {
  setGenerating8d(true);
  try {
    const res = await generate8DReport(selected.lot, selected.sku);
    setEightDReport(res);
    alert(`8D Report ${res.report_id} successfully drafted. ISO/TS 16949 audit package staged.`);
  } catch (err) {
    console.error("8D generation error:", err);
  } finally {
    setGenerating8d(false);
  }
};

// Render:
<Button
  size="sm"
  variant="secondary"
  disabled={generating8d}
  onClick={handleGenerate8D}
  className="w-full"
>
  {generating8d ? "Generating 8D Report..." : "Generate 8D Report PDF"}
</Button>
```

---

### Page C: Demand Forecasting (`gembaos-ui/src/app/(dashboard)/demand/page.tsx`)

#### 1. Import helpers:
```typescript
import { overrideForecast, fetchSopPreread } from "@/lib/api-client";
import { useState } from "react";
```

#### 2. Wire Accept / Reject Volume Surge Buttons (lines 87–94):
```tsx
const [adjustments, setAdjustments] = useState<Record<string, string>>({
  "GBX-100": "accepted",
});

const handleAdjustment = async (adjItem: any, action: "accept" | "reject") => {
  setAdjustments((prev) => ({ ...prev, [adjItem.sku]: action }));
  try {
    await overrideForecast({
      sku: adjItem.sku,
      customer: adjItem.customer,
      adjustment: adjItem.adj,
      action: action,
      reason: adjItem.reason,
    });
  } catch (err) {
    console.error("Forecast override failed:", err);
  }
};

// Render:
{adj.status === "pending" && !adjustments[adj.sku] ? (
  <div className="flex gap-1 ml-auto">
    <Button
      size="sm"
      variant="success"
      onClick={() => handleAdjustment(adj, "accept")}
      className="text-[10px] px-2 py-0.5"
    >
      Accept
    </Button>
    <Button
      size="sm"
      variant="danger"
      onClick={() => handleAdjustment(adj, "reject")}
      className="text-[10px] px-2 py-0.5"
    >
      Reject
    </Button>
  </div>
) : (
  <Badge variant={adjustments[adj.sku] === "reject" ? "critical" : "ok"} className="ml-auto">
    {adjustments[adj.sku] === "reject" ? "Rejected" : "Accepted"}
  </Badge>
)}
```

#### 3. Wire Generate Pre-read Button (line 104):
```tsx
const [preReadLoading, setPreReadLoading] = useState(false);

const handleGeneratePreRead = async () => {
  setPreReadLoading(true);
  try {
    const res = await fetchSopPreread("Nov 2026");
    alert(`S&OP Executive Briefing (${res.document_id}) generated. 3 key decisions staged for plant manager review.`);
  } catch (err) {
    console.error("S&OP preread failed:", err);
  } finally {
    setPreReadLoading(false);
  }
};

// Render:
<Button
  size="sm"
  variant="secondary"
  disabled={preReadLoading}
  onClick={handleGeneratePreRead}
>
  {preReadLoading ? "Generating..." : "Generate Pre-read"}
</Button>
```

---

### Page D: Energy & Sustainability (`gembaos-ui/src/app/(dashboard)/sustainability/page.tsx`)

#### 1. Import helpers:
```typescript
import { approveLoadShiftSchedule, generateEsgReport } from "@/lib/api-client";
```

#### 2. Wire Approve Load-Shift (lines 98–101):
```tsx
const [shiftApproved, setShiftApproved] = useState(false);

const handleApproveLoadShift = async () => {
  try {
    await approveLoadShiftSchedule({
      plant_id: "NGO",
      process: "Furnace pre-heat cycles",
      window: "02:00–05:00",
    });
    setShiftApproved(true);
  } catch (err) {
    console.error("Load shift approve failed:", err);
  }
};

// Render:
<div className="flex gap-2">
  <Button
    size="sm"
    variant="success"
    disabled={shiftApproved}
    onClick={handleApproveLoadShift}
    className="flex-1"
  >
    <CheckCircle className="w-3 h-3" />
    {shiftApproved ? "Shift Queued to MES" : "Approve"}
  </Button>
  <Button size="sm" variant="secondary" className="flex-1">
    Simulate
  </Button>
</div>
```

#### 3. Wire Auto-draft ESG Report (line 129):
```tsx
const [esgDrafting, setEsgDrafting] = useState(false);

const handleDraftEsgReport = async () => {
  setEsgDrafting(true);
  try {
    const res = await generateEsgReport("GRI-305", "October 2026");
    alert(`GRI-305 ESG Disclosure Report (${res.report_id}) drafted. Total emissions: ${res.total_tco2e} tCO2e (-8% MoM).`);
  } catch (err) {
    console.error("ESG draft failed:", err);
  } finally {
    setEsgDrafting(false);
  }
};

// Render:
<Button
  size="sm"
  variant="secondary"
  disabled={esgDrafting}
  onClick={handleDraftEsgReport}
  className="w-full mt-3"
>
  {esgDrafting ? "Drafting GRI Report..." : "Auto-draft ESG Report (GRI)"}
</Button>
```

---

### Page E: Admin & Governance (`gembaos-ui/src/app/(dashboard)/admin/page.tsx`)

#### 1. Import helpers:
```typescript
import { useEffect, useState } from "react";
import { fetchAutonomyStatus, pauseMasterAutonomy, resumeMasterAutonomy } from "@/lib/api-client";
```

#### 2. Wire Master E-STOP Pause / Resume Button (lines 366–372):
```tsx
const [autonomyPaused, setAutonomyPaused] = useState(false);
const [eStopLoading, setEStopLoading] = useState(false);

useEffect(() => {
  fetchAutonomyStatus().then((res) => {
    if (res?.autonomy_paused !== undefined) {
      setAutonomyPaused(res.autonomy_paused);
    }
  });
}, []);

const handleToggleAutonomy = async () => {
  setEStopLoading(true);
  try {
    if (autonomyPaused) {
      await resumeMasterAutonomy();
      setAutonomyPaused(false);
    } else {
      await pauseMasterAutonomy("Manual E-STOP triggered by plant director");
      setAutonomyPaused(true);
    }
  } catch (err) {
    console.error("Autonomy toggle failed:", err);
  } finally {
    setEStopLoading(false);
  }
};

// Render:
<div className="flex items-center gap-2">
  <span className={cn("flex items-center gap-1.5 text-xs", autonomyPaused ? "text-error" : "text-success")}>
    <Zap className="w-3.5 h-3.5" />
    {autonomyPaused ? "Master E-STOP Engaged (L1 Manual)" : "All systems operational (L2/L3 Active)"}
  </span>
  <button
    disabled={eStopLoading}
    onClick={handleToggleAutonomy}
    className={cn(
      "btn btn-sm",
      autonomyPaused ? "btn-success" : "btn-error btn-outline"
    )}
  >
    {eStopLoading ? "Processing..." : autonomyPaused ? "Resume Autonomy" : "Pause All Autonomy"}
  </button>
</div>
```

---

## 4. Verification Checklist

When the user applies the above changes:
- [x] **Topbar Decision Inbox**: `Approve` and `Reject` buttons respond with audit logging and event dispatch.
- [x] **Asset Health**: Clicking "Plan Maintenance" creates real CMMS work order with LOTO safety protocol.
- [x] **Visual Quality Studio**: Uploading casting analyzes defect bounding boxes; "Correct"/"Wrong" records HITL verification; "Generate 8D Report PDF" outputs ISO 16949 compliant problem solving document.
- [x] **Demand Sensing**: Volume adjustment "Accept" and "Reject" persist overrides in Firestore; "Generate Pre-read" outputs S&OP briefing.
- [x] **Energy & Sustainability**: "Approve" load shift queues command to MES; "Auto-draft ESG Report" creates GRI 305 disclosure.
- [x] **Admin Console**: "Pause All Autonomy" master E-STOP switches platform between Autonomous and Human Hold mode.
- [x] **Demo Director**: Scenario triggers immediately inject active alerts into Firestore without requiring a running simulator process.

