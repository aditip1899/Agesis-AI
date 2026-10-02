# 🛡️ AegisAI — Generative Chat & Code Governance Platform

Track generative-AI usage across ChatGPT, Codex, Copilot & CLIs, and turn invisible AI
activity into clear insight on **spend, code adoption, efficiency and risk** — for every
employee and for the compliance team. Built on **React 19 + FastAPI + MongoDB**, with
**Claude & ChatGPT** insights, a streaming copilot, live tool-risk scoring, budget alerts
(in-app + Slack), and an AI-generated cost-efficiency runbook.

>  A narrated demo video is included at [`frontend/public/aegisai-demo.mp4`](frontend/public/aegisai-demo.mp4).
>  Slide deck: [`docs/PRESENTATION.md`](docs/PRESENTATION.md) · Demo script: [`docs/DEMO_VIDEO_SCRIPT.md`](docs/DEMO_VIDEO_SCRIPT.md)

---

## Features

- **Personal dashboard** — spend, tokens, % AI-authored code, efficiency score; spend trend, category split, Plan/Ask/Agent/Skills mode usage.
- **Org governance** (compliance) — spend vs budget, active engineers, % AI-generated code, department drilldown, connector status.
- **Compliance audit center** — anomaly, PII, GPL-license and shadow-AI alerts with plain-language explanations.
- **Cost & Runbook** — cost-per-outcome KPIs, token-budget gauge with "about to run out" reminder, and a Claude/ChatGPT-generated **cost-efficiency runbook** exportable as Markdown / PDF.
- **AI Tool Risk** — editable connector policies (SSO, retention, egress, license-scan, sandboxed) with a **live risk score** = failing-policy weights + recent-alert signal.
- **Ask Aegis** — streaming copilot (Claude & ChatGPT) grounded only in your telemetry.
- **Budget Alerts** — in-app feed + Slack webhook delivery + a **daily automated budget check** (platform cron).
- **CSV/JSON usage import** and **AI Insights** with a model picker (Claude Sonnet 5.5 / 4.6 / Haiku 4.5 / ChatGPT).
- **JWT auth** with role-based access (employee vs compliance).

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind v4, shadcn/ui, Recharts, Framer Motion |
| Backend | FastAPI, Motor (async MongoDB), PyJWT, bcrypt |
| Database | MongoDB |
| AI | Claude & ChatGPT + OpenAI TTS via Emergent LLM key |
| Scheduling | Platform cron (`.emergent/crons.yml`) |

---

## Getting Started

### Prerequisites
- Python 3.11+, Node 18+ & Yarn, MongoDB running locally

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
# create backend/.env (see below)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend
```bash
cd frontend
yarn install
yarn dev            # serves on port 3000
```

### 3. Environment variables

`backend/.env`
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="aegisai"
CORS_ORIGINS="http://localhost:3000"
JWT_SECRET="<random-64-char-hex>"
ADMIN_EMAIL="compliance@corp.internal"
ADMIN_PASSWORD="<strong-unique-password>"
EMPLOYEE_EMAIL="employee@corp.internal"
EMPLOYEE_PASSWORD="<strong-unique-password>"
EMERGENT_LLM_KEY="<your-emergent-or-provider-key>"
WEBHOOK_CRON_SECRET="<random-32+-char-secret>"
```

`frontend/.env`
```
REACT_APP_BACKEND_URL="http://localhost:8001"
```

> On first run the backend seeds demo users, usage events, alerts and connector policies.

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Compliance Admin | `compliance@corp.internal` | `compliance123` |
| Employee | `employee@corp.internal` | `employee123` |

> ⚠️ Change these before any real deployment.

---

## API Overview

All routes are prefixed with `/api`.

- **Auth** — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/profile`
- **Telemetry** — `GET /personal/summary`, `GET /corporate/summary`, `GET /compliance/alerts`, `POST /import`
- **AI** — `POST /insights`, `POST /assistant/chat`, `POST /assistant/stream`, `POST /cost/runbook`
- **Cost & Risk** — `GET /cost/efficiency`, `GET /cost/tool-risk`, `GET/PUT /connectors/policies/{tool}`
- **Alerts** — `GET /notifications`, `POST /notifications/check`, `GET/PUT /settings`, `POST /settings/test-slack`
- **Cron** — `POST /cron/budget-check` (Bearer `WEBHOOK_CRON_SECRET`)

---

## Scheduled Jobs

`.emergent/crons.yml` defines a daily budget check (`08:00 UTC`) that calls
`/api/cron/budget-check` and raises in-app + Slack alerts when token usage crosses the threshold.

---

## Security Notes

- Bearer-token auth (no cookies) · CORS without credentials · login rate-limiting.
- Slack webhook URLs are allowlisted to `https://hooks.slack.com/` (SSRF protection).
- Uploads capped at 2 MB / 5000 rows. Set strong secrets and a locked-down `CORS_ORIGINS` in production.

