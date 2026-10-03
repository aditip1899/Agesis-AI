# AegisAI — Generative Chat & Code Governance Platform
## Project Design Document (v1)

### 1. Problem & Vision
Organizations now run their engineering, learning and writing work through generative-AI
surfaces — ChatGPT, Codex, Copilot CLI, Claude and internal CLI agents. Today that usage is
invisible: nobody knows **how much is being spent, on what category of work, how much shipped
code is AI-authored, or whether it is being used efficiently and safely.**

**AegisAI** is a governance layer that tracks generative-AI usage across apps and CLIs, and turns
raw telemetry into insights on **spend trends, work categories, AI-code adoption and efficiency** —
for both the **individual employee** (personal productivity) and the **compliance/exec team**
(org-wide governance and audit). The dashboard is visible to all employees; deep category
insights and audit tooling are reserved for the compliance team.

### 2. Users & Roles
| Role | Sees | Purpose |
|------|------|---------|
| **Employee** | Personal telemetry only | Understand own spend, modes, categories, efficiency & upskilling |
| **Compliance / Exec Admin** | Personal + Org governance + Audit center | Budget control, AI-code oversight, anomaly/PII/license audit |

### 3. Core Data Model (`usage_events`)
Each generative-AI interaction is one event:
`app` (ChatGPT/Codex/Copilot CLI/Claude), `mode` (Plan/Ask/Agent/Skills),
`category` (Engineering, Learning, Documentation, Debugging, Data/Scripts),
`department`, `cost`, `tokens_in/out`, `code_lines`, `ai_lines`, `accepted`, `suggested`,
`iterations`, `ts`, `source` (seed | import | api).

### 4. Key Metrics
- **Total AI Spend** ($) + budget variance
- **Token consumption** (input vs output)
- **AI Code Ingestion Ratio** — % of committed lines authored by AI vs human
- **Acceptance rate** — accepted vs suggested lines (efficiency signal)
- **Prompt efficiency** — avg iterations to resolution
- **Estimated hours saved**
- **Category & mode distribution**

### 5. Feature Set (MVP built)
1. **Auth** — email/password (JWT), demo employee & compliance accounts, role-based access.
2. **Personal Dashboard** — KPI row, spend trend, spend by app, mode dial, category donut, efficiency.
3. **Corporate Governance** (compliance) — org KPIs, department drilldown, % AI-code, budget vs spend.
4. **Compliance Audit Center** (compliance) — anomaly / spend-spike / PII / license / shadow-AI alerts.
5. **CSV / JSON Importer** — upload OpenAI/Anthropic/CLI usage exports; charts update live.
6. **AI Insights** — Claude-generated natural-language summaries, alerts & recommendations from live telemetry.
7. **Live connectors panel** — org-level API connector status (Codex / ChatGPT Team / Copilot / CLI).

### 6. Recommended non-generic functionality (differentiators)
These make the product feel reliable and enterprise-grade beyond a basic chart dashboard:

- **AI Code Ingestion Ratio + acceptance rate** — most trackers only show $ spend; measuring how
  much AI code actually *ships* and *survives review* is the real governance signal.
- **Prompt-efficiency score (iterations-to-resolution)** — surfaces *wasteful* usage, not just heavy usage.
- **Anomaly / spend-spike detection** with natural-language explainers (LLM-written "why").
- **Compliance guardrails**: PII-in-prompt detection, GPL/license-conflict flagging on suggested code,
  and **Shadow-AI detection** (unsanctioned model endpoints) — turns the tool into a risk product.
- **Category benchmarking** — compare a person/department efficiency against org benchmarks.
- **Budget variance alerts** at configurable thresholds.
- **Non-punitive framing** — insights champion upskilling & productivity, encouraging adoption.

### 7. Future backlog (P1/P2)
- Live API ingestion connectors (OpenAI/Anthropic usage APIs, GitHub Copilot, self-hosted CLI webhooks).
- SSO / SAML / Google Workspace login.
- Repo-level AI-code attribution via git blame + commit signing.
- Exportable compliance PDF reports & scheduled digests.
- Per-team budgets, quotas and automated throttling.
- Real-time streaming telemetry (WebSocket) and alert routing to Slack/email.

### 8. Architecture
- **Frontend**: React 19 + Tailwind v4 + Recharts + shadcn/ui. Token-based auth (localStorage + Bearer).
- **Backend**: FastAPI, all routes under `/api`. Aggregations computed from `usage_events`.
- **DB**: MongoDB (`users`, `usage_events`, `alerts`).
- **AI**: Emergent LLM key → Claude Sonnet 4.6 for insight generation (graceful fallback if unavailable).
