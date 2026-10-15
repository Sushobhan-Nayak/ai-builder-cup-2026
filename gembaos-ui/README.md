# GembaOS Frontend — Executive Mission Control & Shop Floor UI

The frontend mission control for **GembaOS**, built with **Next.js 16 (App Router)**, **Tailwind CSS v4**, and **DaisyUI 5 (Abyss dark theme)**.

---

## 🚀 Key Modules & Pages

| Route | View | Description |
| :--- | :--- | :--- |
| `/` | **Command Center** | Executive mission control with live multi-plant Google Map status, KPI ribbons, and 1-click human-in-the-loop decision authorization. |
| `/supply-chain` | **Supply Chain Control Tower** | Multi-tier logistics visualizer with realistic maritime route paths, Typhoon Haikui-2 storm tracker, and 5-hop Spanner Graph blast radius traversal. |
| `/war-room` & `/[id]` | **Agent War Room** | Multi-agent debate transcript with comparative trade-off matrix and Critic audit verdict. |
| `/planner` | **Production Planner** | Discrete-time machine schedule Gantt chart powered by Google OR-Tools CP-SAT discrete-time solver and CTP calculator. |
| `/quality` | **Quality Studio** | Multimodal die-casting computer vision defect inspection with normalized bounding box canvas. |
| `/assets/[id]` | **Asset Detail** | Deep-dive vibration telemetry time-series, FFT spectrum, and TimesFM predictive remaining useful life (RUL). |
| `/live` | **Gemba Live Assistant** | Voice-first technician companion with Lockout/Tagout (LOTO) safety checklist. |

---

## 🛠️ Tech Stack

* **Framework:** Next.js 16.4.0 (App Router, Webpack/Turbopack)
* **Styling:** Tailwind CSS v4 + DaisyUI 5.7 (Abyss Dark Palette)
* **Maps:** Google Maps JavaScript API (Dark styled) + Tactical Vector Digital Twin Fallback
* **Icons & Animation:** Lucide React, Framer Motion
* **State Management:** Zustand
* **Charts:** Recharts

---

## 💻 Development Commands

```powershell
# Install dependencies
npm install

# Run development server on port 3001
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## 🔑 Google Maps Configuration

The frontend dynamically loads your Google Maps JavaScript API key using the following hierarchy:
1. `localStorage.getItem("GEMBAOS_MAPS_KEY")` (Enter via the "Connect Key" modal in the UI)
2. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Build-time environment variable)
3. `/api/maps-key` (Dynamic runtime fetch from the Cloud Run container environment variable `GOOGLE_MAPS_API_KEY`)

Even without an API key, the map seamlessly falls back to the high-fidelity Tactical Vector Digital Twin.
