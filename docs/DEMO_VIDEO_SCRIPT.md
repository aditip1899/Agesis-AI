# AegisAI — Demo Video Script & Storyboard

> I can't record an actual video for you, but this is a ready-to-record script + shot list.
> Record with Loom / OBS / QuickTime at 1280×800, then drop the `.mp4` into the repo
> (e.g. `docs/demo.mp4`) and link it from the README. Target length: **~2.5–3 minutes**.

---

## Setup before recording
- Log in as **compliance@corp.internal / compliance123** (sees everything).
- Have a small CSV ready to import (columns: `app,mode,category,department,cost,tokens_in,tokens_out,code_lines,ai_lines,ts`).
- Browser zoom 100%, hide bookmarks bar, dark mode (default).

---

## Shot list & narration

### 0:00 – 0:20 · Hook (Login screen)
**On screen:** AegisAI login with the split hero.
**Say:** "Every team now runs on ChatGPT, Codex and CLIs — but that usage is invisible. AegisAI is a governance layer that makes AI spend, code and efficiency measurable. Let me show you."
**Action:** Click the **Compliance Admin** demo chip → Sign in.

### 0:20 – 0:50 · Personal dashboard
**On screen:** My Usage.
**Say:** "Every employee gets their own view — total spend, tokens, how much of their committed code is AI-authored, and an efficiency score. Below: spend trend, category split, and Plan/Ask/Agent/Skills mode usage."
**Action:** Hover a couple of charts. Switch the **7d / 30d / 90d** range once.

### 0:50 – 1:10 · Import + AI Insights
**Say:** "Usage can be imported from a CSV or JSON export — charts update instantly."
**Action:** Drag the CSV into the importer (toast appears).
**Say:** "And AI Insights reads the real telemetry — powered by Claude or ChatGPT."
**Action:** Pick a model in the picker → click **Generate** → let the summary render.

### 1:10 – 1:35 · Ask Aegis (streaming)
**Say:** "There's also a copilot on every page. It only answers from your real data — and it streams."
**Action:** Open **Ask Aegis**, click a suggestion, let the answer stream word-by-word.

### 1:35 – 2:00 · Org Governance
**Say:** "Compliance gets the org view — total spend vs budget, active engineers, percent AI-generated code, and a department drilldown showing which teams lean hardest on AI."
**Action:** Go to **Org Governance**; point at the department table bars and connectors panel.

### 2:00 – 2:25 · Cost & Runbook + live risk
**Say:** "The Cost page tracks cost-per-outcome and a token budget with an 'about to run out' reminder. The AI Tool Risk panel scores each tool from editable policies plus live alert signals — watch it recompute."
**Action:** Toggle a policy chip on **Internal CLI** → score drops live.
**Say:** "And it generates a shareable cost-efficiency runbook you can export as Markdown or PDF for your doc hub."
**Action:** Click **Generate**, then **.md** / **PDF**.

### 2:25 – 2:45 · Alerts + automation (Audit Center)
**Say:** "Budget alerts fire in-app and to Slack, and run automatically every day. The Audit Center flags anomalies, PII, license conflicts and shadow-AI."
**Action:** Open **Alerts** (show feed + Slack field), then **Audit Center**.

### 2:45 – 3:00 · Close
**Say:** "AegisAI — govern generative-AI spend, code and efficiency, without slowing engineers down."
**Action:** Return to the dashboard; end on the AegisAI logo.

---

## Optional captions / lower-thirds
- "% AI-authored code" · "Iterations-to-resolution" · "Live tool-risk from editable policies"
- "Streaming answers, grounded in your data" · "Daily automated budget checks"

## Export & upload
1. Record → export `demo.mp4` (H.264, ~1080p).
2. Place at `docs/demo.mp4` (or upload to YouTube/Loom and link).
3. In `README.md`, embed a thumbnail image linking to the video.
