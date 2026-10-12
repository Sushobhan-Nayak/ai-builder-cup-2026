# GembaOS — Gemini at the Gemba 🏭✨
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Deployed-blue?logo=googlecloud)](https://cloud.google.com/)
[![Gemini](https://img.shields.io/badge/Powered_by-Gemini_3.x-purple?logo=googlebard)](#)

**An agentic AI operating layer that sees, reasons and acts across the entire manufacturing value chain.**

GembaOS puts a council of specialized Gemini-powered agents on top of a unified IT/OT data foundation to close the decision gap in manufacturing. From predicting bearing failures to re-routing supply chains around typhoons, GembaOS turns operational data into insights, recommendations, and approved actions in minutes.

![War Room UI](docs/video/war_room_demo.gif)
*The Agent War Room: Cross-functional negotiation with evidence-backed Decision Briefs.*

### Google Cloud Services Used
| Category | Services |
| :--- | :--- |
| **AI & Agents** | Gemini 3.8 Flash, 3.1 Pro, 3.8 Live, Gemini Embedding 2; ADK 2.0 on Agent Platform; Model Armor |
| **Data & ML** | BigQuery (TimesFM, `AI.DETECT_ANOMALIES`, Graph), Firestore, Cloud Storage, BQML |
| **Compute & Eventing** | Cloud Run, Eventarc, Pub/Sub, Dataflow, Cloud Scheduler |
| **Experience** | Firebase App Hosting, Route Optimization API, Maps JavaScript API |

### Quickstart
1. **Bootstrap:** `make bootstrap` (Enables APIs, provisions resources via Terraform)
2. **Seed:** `make seed` (Loads Nova Drive master data and 18 months of historical telemetry)
3. **Deploy:** `make deploy` (Builds and deploys all Cloud Run services and Next.js frontend)

### Demo Credentials
* **URL:** `https://gembaos-demo.web.app` (Example)
* **Login:** `judge1@gembaos.dev` (See submission details for password)
* **Video Demo:** [Watch the 3-minute pitch](link-to-video)

### Architecture
![Architecture](docs/architecture.png)