from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import csv
import json
import random
import logging
import secrets
import hmac
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
import requests

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aegisai")

APPS = ["ChatGPT", "Codex", "Copilot CLI", "Claude"]
MODES = ["plan", "ask", "agent", "skills"]
CATEGORIES = [
    "Engineering & Architecture",
    "Learning & Upskilling",
    "Documentation & Technical Writing",
    "Debugging & Incident Resolution",
    "Data Analytics & Scripts",
]
DEPARTMENTS = ["Frontend", "Backend", "DevOps", "Data Science", "Product", "Legal"]

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_compliance(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "compliance":
        raise HTTPException(status_code=403, detail="Compliance access required")
    return user

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str = "Team Member"

class LoginInput(BaseModel):
    email: EmailStr
    password: str

# id -> (provider, model). Shared by insights, assistant and runbook.
MODEL_CATALOG = {
    "claude-sonnet-5-5": ("anthropic", "claude-sonnet-5-5"),
    "claude-sonnet-4-6": ("anthropic", "claude-sonnet-4-6"),
    "claude-haiku-4-5": ("anthropic", "claude-haiku-4-5-20251001"),
    "gpt-5.4": ("openai", "gpt-5.4"),
}

def resolve_model(model_id: str):
    return MODEL_CATALOG.get(model_id, MODEL_CATALOG["claude-sonnet-4-6"])

class InsightRequest(BaseModel):
    scope: str = "personal"  # personal | corporate
    range: str = "30d"
    model: str = "claude-sonnet-4-6"

class ChatRequest(BaseModel):
    message: str
    scope: str = "personal"
    model: str = "gpt-5.4"

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    token_budget: Optional[int] = None

class RunbookRequest(BaseModel):
    scope: str = "personal"
    model: str = "claude-sonnet-4-6"

def set_auth_cookie(response: Response, token: str):
    # Deprecated: auth is Bearer-token only (no cookie). Kept as no-op for compatibility.
    return None

# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(body: RegisterInput, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {"email": email, "password_hash": hash_password(body.password),
           "name": body.name, "role": "employee", "created_at": datetime.now(timezone.utc)}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    await seed_user_events(uid, email)
    token = create_access_token(uid, email)
    return {"id": uid, "email": email, "name": body.name, "role": "employee", "token": token}

@api_router.post("/auth/login")
async def login(body: LoginInput, request: Request):
    email = body.email.lower()
    ident = f"login:{email}"
    now = datetime.now(timezone.utc)
    rec = await db.login_attempts.find_one({"identifier": ident})
    if rec and rec.get("count", 0) >= 5 and rec.get("until") and rec["until"] > now.isoformat():
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        cnt = (rec.get("count", 0) if rec else 0) + 1
        upd = {"identifier": ident, "count": cnt}
        if cnt >= 5:
            upd["until"] = (now + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    uid = str(user["_id"])
    token = create_access_token(uid, email)
    return {"id": uid, "email": email, "name": user.get("name"),
            "role": user.get("role", "employee"), "token": token}

@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api_router.patch("/auth/profile")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {}
    if body.name is not None and body.name.strip():
        updates["name"] = body.name.strip()
    if body.token_budget is not None:
        updates["token_budget"] = max(0, int(body.token_budget))
    if updates:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": updates})
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------
def range_to_days(r: str) -> int:
    return {"7d": 7, "30d": 30, "90d": 90, "quarter": 90}.get(r, 30)

async def fetch_events(query: dict, days: int) -> list:
    start = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {**query, "ts": {"$gte": start}}
    return await db.usage_events.find(q, {"_id": 0}).to_list(20000)

def summarize(events: list) -> dict:
    total_cost = round(sum(e["cost"] for e in events), 2)
    total_in = sum(e["tokens_in"] for e in events)
    total_out = sum(e["tokens_out"] for e in events)
    sessions = len(events)
    code_lines = sum(e.get("code_lines", 0) for e in events)
    ai_lines = sum(e.get("ai_lines", 0) for e in events)
    accepted = sum(e.get("accepted", 0) for e in events)
    suggested = sum(e.get("suggested", 0) for e in events)
    iters = [e.get("iterations", 1) for e in events] or [1]

    def bucket(key):
        d = {}
        for e in events:
            d[e[key]] = round(d.get(e[key], 0) + e["cost"], 2)
        return d

    # spend over time (daily)
    by_day = {}
    for e in events:
        day = e["ts"][:10]
        by_day.setdefault(day, 0.0)
        by_day[day] += e["cost"]
    trend = [{"date": d, "cost": round(c, 2)} for d, c in sorted(by_day.items())]

    ai_code_pct = round((ai_lines / code_lines * 100) if code_lines else 0, 1)
    accept_rate = round((accepted / suggested * 100) if suggested else 0, 1)
    return {
        "kpis": {
            "total_cost": total_cost,
            "tokens_in": total_in,
            "tokens_out": total_out,
            "sessions": sessions,
            "ai_code_pct": ai_code_pct,
            "accept_rate": accept_rate,
            "avg_iterations": round(sum(iters) / len(iters), 1),
            "hours_saved": round(ai_lines / 55.0, 1),
        },
        "by_app": [{"name": k, "value": v} for k, v in bucket("app").items()],
        "by_mode": [{"name": k, "value": v} for k, v in bucket("mode").items()],
        "by_category": [{"name": k, "value": v} for k, v in bucket("category").items()],
        "trend": trend,
    }

@api_router.get("/personal/summary")
async def personal_summary(range: str = "30d", user: dict = Depends(get_current_user)):
    events = await fetch_events({"user_id": user["id"]}, range_to_days(range))
    return summarize(events)

@api_router.get("/corporate/summary")
async def corporate_summary(range: str = "30d", user: dict = Depends(require_compliance)):
    events = await fetch_events({}, range_to_days(range))
    base = summarize(events)
    # department breakdown
    dept = {}
    engineers = set()
    for e in events:
        d = e.get("department", "Other")
        dept.setdefault(d, {"cost": 0.0, "ai_lines": 0, "code_lines": 0, "engineers": set()})
        dept[d]["cost"] += e["cost"]
        dept[d]["ai_lines"] += e.get("ai_lines", 0)
        dept[d]["code_lines"] += e.get("code_lines", 0)
        dept[d]["engineers"].add(e["user_id"])
        engineers.add(e["user_id"])
    dept_rows = []
    for name, v in dept.items():
        pct = round((v["ai_lines"] / v["code_lines"] * 100) if v["code_lines"] else 0, 1)
        dept_rows.append({"department": name, "cost": round(v["cost"], 2),
                          "ai_code_pct": pct, "engineers": len(v["engineers"])})
    dept_rows.sort(key=lambda x: -x["cost"])
    base["departments"] = dept_rows
    base["kpis"]["active_engineers"] = len(engineers)
    base["kpis"]["monthly_budget"] = 12000
    return base

@api_router.get("/compliance/alerts")
async def compliance_alerts(user: dict = Depends(require_compliance)):
    alerts = await db.alerts.find({}, {"_id": 0}).sort("ts", -1).to_list(100)
    return alerts

# ---------------------------------------------------------------------------
# Import (CSV / JSON)
# ---------------------------------------------------------------------------
MAX_IMPORT_BYTES = 2 * 1024 * 1024
MAX_IMPORT_ROWS = 5000

@api_router.post("/import")
async def import_usage(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 2 MB).")
    raw = raw_bytes.decode("utf-8", errors="ignore")
    name = (file.filename or "").lower()
    try:
        if name.endswith(".json") or raw.strip().startswith(("[", "{")):
            data = json.loads(raw)
            rows = data if isinstance(data, list) else data.get("events", [])
        else:
            rows = list(csv.DictReader(io.StringIO(raw)))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse file. Provide valid CSV or JSON.")
    if not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="Unexpected file structure.")
    rows = rows[:MAX_IMPORT_ROWS]
    docs = []
    for r in rows:
        try:
            docs.append(normalize_event(r, user))
        except Exception:
            continue
    if docs:
        await db.usage_events.insert_many(docs)
    return {"inserted": len(docs), "detected": file.filename}

def normalize_event(r: dict, user: dict) -> dict:
    def g(*keys, default=None):
        for k in keys:
            if k in r and r[k] not in (None, ""):
                return r[k]
        return default
    cost = float(g("cost", "spend", "amount", default=0) or 0)
    tin = int(float(g("tokens_in", "input_tokens", "prompt_tokens", default=0) or 0))
    tout = int(float(g("tokens_out", "output_tokens", "completion_tokens", default=0) or 0))
    code_lines = int(float(g("code_lines", "lines", default=0) or 0))
    ai_lines = int(float(g("ai_lines", "ai_generated_lines", default=0) or 0))
    ts = g("ts", "timestamp", "date", default=datetime.now(timezone.utc).isoformat())
    return {
        "user_id": user["id"],
        "email": user["email"],
        "app": g("app", "product", default="ChatGPT"),
        "mode": (g("mode", default="ask") or "ask").lower(),
        "category": g("category", default="Engineering & Architecture"),
        "department": g("department", "team", default="Backend"),
        "cost": cost, "tokens_in": tin, "tokens_out": tout,
        "code_lines": code_lines, "ai_lines": ai_lines,
        "accepted": int(float(g("accepted", default=ai_lines) or 0)),
        "suggested": int(float(g("suggested", default=code_lines) or 0)),
        "iterations": int(float(g("iterations", default=2) or 2)),
        "ts": str(ts) if len(str(ts)) > 10 else f"{ts}T12:00:00+00:00",
        "source": "import",
    }

# ---------------------------------------------------------------------------
# AI Insights
# ---------------------------------------------------------------------------
@api_router.post("/insights")
async def insights(body: InsightRequest, user: dict = Depends(get_current_user)):
    if body.scope == "corporate" and user.get("role") != "compliance":
        raise HTTPException(status_code=403, detail="Compliance access required")
    query = {} if body.scope == "corporate" else {"user_id": user["id"]}
    data = summarize(await fetch_events(query, range_to_days(body.range)))
    context = json.dumps({"kpis": data["kpis"], "by_app": data["by_app"],
                          "by_category": data["by_category"], "by_mode": data["by_mode"],
                          "departments": data.get("departments", [])}, default=str)
    system = ("You are an AI usage governance analyst for AegisAI. Given generative-AI "
              "telemetry, produce concise, specific, non-generic insights for a "
              f"{'compliance/executive' if body.scope=='corporate' else 'personal productivity'} audience. "
              "Return STRICT JSON with keys: summary (1 sentence), insights (array of 3 objects "
              "with keys title, detail, tone[positive|warning|neutral]), recommendations (array of 3 strings). "
              "Reference real numbers from the data. No markdown, JSON only.")
    try:
        prov, model = resolve_model(body.model)
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"insight-{user['id']}",
                       system_message=system).with_model(prov, model)
        resp = await chat.send_message(UserMessage(text=f"Telemetry data:\n{context}"))
        text = resp.strip()
        if text.startswith("```"):
            text = text.split("```")[1].replace("json", "", 1).strip()
        return json.loads(text)
    except Exception as e:
        logger.warning(f"insight generation failed: {e}")
        k = data["kpis"]
        return {
            "summary": f"You logged ${k['total_cost']} across {k['sessions']} sessions with {k['ai_code_pct']}% AI-authored code.",
            "insights": [
                {"title": "Spend", "detail": f"Total spend is ${k['total_cost']} for this period.", "tone": "neutral"},
                {"title": "Code adoption", "detail": f"{k['ai_code_pct']}% of committed lines were AI-authored.", "tone": "positive"},
                {"title": "Efficiency", "detail": f"Avg {k['avg_iterations']} iterations to resolution; ~{k['hours_saved']}h saved.", "tone": "positive"},
            ],
            "recommendations": [
                "Route quick lookups to Ask mode to cut token spend.",
                "Increase review on high AI-code-ratio departments.",
                "Set a budget alert at 80% of monthly threshold.",
            ],
        }

# ---------------------------------------------------------------------------
# Ask Aegis — ChatGPT-powered assistant
# ---------------------------------------------------------------------------
@api_router.post("/assistant/chat")
async def assistant_chat(body: ChatRequest, user: dict = Depends(get_current_user)):
    scope = body.scope
    if scope == "corporate" and user.get("role") != "compliance":
        scope = "personal"
    query = {} if scope == "corporate" else {"user_id": user["id"]}
    data = summarize(await fetch_events(query, 30))
    context = json.dumps({"kpis": data["kpis"], "by_app": data["by_app"],
                          "by_category": data["by_category"], "by_mode": data["by_mode"],
                          "departments": data.get("departments", [])}, default=str)
    system = ("You are Aegis Copilot, a ChatGPT-powered assistant inside a generative-AI usage "
              "governance dashboard. Answer questions about the user's AI usage, spend, code "
              "adoption and efficiency using ONLY the telemetry provided. Be concise and specific, "
              "cite real numbers, and reply in plain text (no markdown headings). "
              f"Scope: {scope}. Telemetry JSON: {context}")
    await db.chat_messages.insert_one({"user_id": user["id"], "role": "user",
                                       "content": body.message,
                                       "ts": datetime.now(timezone.utc).isoformat()})
    prov, model = resolve_model(body.model)
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"assistant-{user['id']}",
                       system_message=system).with_model(prov, model)
        reply = (await chat.send_message(UserMessage(text=body.message))).strip()
    except Exception as e:
        logger.warning(f"assistant failed: {e}")
        raise HTTPException(status_code=502, detail="Assistant is temporarily unavailable.")
    await db.chat_messages.insert_one({"user_id": user["id"], "role": "assistant",
                                       "content": reply,
                                       "ts": datetime.now(timezone.utc).isoformat()})
    return {"reply": reply, "model": body.model, "provider": prov}

@api_router.post("/assistant/stream")
async def assistant_stream(body: ChatRequest, user: dict = Depends(get_current_user)):
    scope = body.scope
    if scope == "corporate" and user.get("role") != "compliance":
        scope = "personal"
    query = {} if scope == "corporate" else {"user_id": user["id"]}
    data = summarize(await fetch_events(query, 30))
    context = json.dumps({"kpis": data["kpis"], "by_app": data["by_app"],
                          "by_category": data["by_category"], "by_mode": data["by_mode"],
                          "departments": data.get("departments", [])}, default=str)
    system = ("You are Aegis Copilot, an assistant inside a generative-AI usage governance "
              "dashboard. Answer questions about the user's AI usage, spend, code adoption and "
              "efficiency using ONLY the telemetry provided. Be concise and specific, cite real "
              f"numbers, plain text (no markdown headings). Scope: {scope}. Telemetry JSON: {context}")
    await db.chat_messages.insert_one({"user_id": user["id"], "role": "user",
                                       "content": body.message,
                                       "ts": datetime.now(timezone.utc).isoformat()})
    prov, model = resolve_model(body.model)

    async def gen():
        parts = []
        try:
            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"assistant-{user['id']}",
                           system_message=system).with_model(prov, model)
            async for ev in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(ev, TextDelta):
                    parts.append(ev.content)
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.warning(f"stream failed: {e}")
            yield f"data: {json.dumps({'error': 'Assistant unavailable'})}\n\n"
        reply = "".join(parts).strip()
        if reply:
            await db.chat_messages.insert_one({"user_id": user["id"], "role": "assistant",
                                               "content": reply,
                                               "ts": datetime.now(timezone.utc).isoformat()})
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

# ---------------------------------------------------------------------------
# Cost efficiency, token budget & tool risk
# ---------------------------------------------------------------------------
@api_router.get("/cost/efficiency")
async def cost_efficiency(scope: str = "personal", range: str = "30d",
                          user: dict = Depends(get_current_user)):
    if scope == "corporate" and user.get("role") != "compliance":
        scope = "personal"
    query = {} if scope == "corporate" else {"user_id": user["id"]}
    days = range_to_days(range)
    events = await fetch_events(query, days)
    data = summarize(events)
    k = data["kpis"]
    total_tokens = k["tokens_in"] + k["tokens_out"]
    accepted = sum(e.get("accepted", 0) for e in events)

    cost_per_session = round(k["total_cost"] / k["sessions"], 4) if k["sessions"] else 0
    cost_per_accepted = round(k["total_cost"] / accepted, 4) if accepted else 0
    cost_per_hour_saved = round(k["total_cost"] / k["hours_saved"], 4) if k["hours_saved"] else 0
    eff_score = round(min(100, k["accept_rate"] * 0.6 + max(0, (5 - k["avg_iterations"])) / 5 * 40), 1)

    budget = user.get("token_budget") or (5_000_000 if scope == "personal" else 60_000_000)
    used_pct = round(min(100, total_tokens / budget * 100), 1) if budget else 0
    remaining = max(0, budget - total_tokens)
    daily = total_tokens / days if days else 0
    days_left = round(remaining / daily, 1) if daily else None
    reminder = None
    if used_pct >= 80:
        reminder = (f"You've used {used_pct}% of your {budget:,}-token budget"
                    + (f" — about {days_left} days left at the current pace." if days_left is not None else "."))
    return {
        "scope": scope,
        "kpis": {
            "total_cost": k["total_cost"], "total_tokens": total_tokens,
            "cost_per_session": cost_per_session, "cost_per_accepted_line": cost_per_accepted,
            "cost_per_hour_saved": cost_per_hour_saved, "efficiency_score": eff_score,
            "accept_rate": k["accept_rate"], "avg_iterations": k["avg_iterations"],
            "hours_saved": k["hours_saved"],
        },
        "token_budget": {"budget": budget, "used": total_tokens, "used_pct": used_pct,
                         "remaining": remaining, "days_left": days_left, "reminder": reminder},
        "trend": data["trend"],
        "by_category": [{"name": c["name"], "cost": c["value"]} for c in data["by_category"]],
        "by_app": data["by_app"],
    }

POLICY_WEIGHTS = {
    "sanctioned": 25, "sso_required": 15, "retention_off": 15,
    "egress_restricted": 20, "license_scan": 15, "sandboxed": 10,
}
POLICY_LABELS = {
    "sanctioned": "Sanctioned connector", "sso_required": "SSO enforced",
    "retention_off": "Data retention off", "egress_restricted": "Egress restricted",
    "license_scan": "License scan on suggestions", "sandboxed": "Agent actions sandboxed",
}
ALERT_TOOL_MAP = {"Shadow AI": "Internal CLI", "License": "Copilot", "Anomaly": "Codex CLI"}

def risk_level(score: int) -> str:
    return "Low" if score < 30 else ("Medium" if score < 60 else "High")

async def compute_tool_risk() -> list:
    docs = await db.connector_policies.find({}, {"_id": 0}).to_list(100)
    alerts = await db.alerts.find({}, {"_id": 0}).to_list(200)
    bump = {}
    for a in alerts:
        t = ALERT_TOOL_MAP.get(a.get("category"))
        if t:
            bump[t] = min(16, bump.get(t, 0) + 8)
    out = []
    for d in docs:
        pol = d["policies"]
        base = sum(POLICY_WEIGHTS[k] for k, ok in pol.items() if k in POLICY_WEIGHTS and not ok)
        b = bump.get(d["tool"], 0)
        score = min(100, base + b)
        failing = [POLICY_LABELS[k] for k, ok in pol.items() if k in POLICY_WEIGHTS and not ok]
        note = ("All governance controls pass." if not failing else "Failing controls: " + ", ".join(failing))
        out.append({
            "tool": d["tool"], "risk": risk_level(score), "score": score, "alert_bump": b, "notes": note,
            "policies": [{"key": k, "label": POLICY_LABELS[k], "pass": bool(pol.get(k, True)), "weight": POLICY_WEIGHTS[k]}
                         for k in POLICY_WEIGHTS],
        })
    out.sort(key=lambda x: -x["score"])
    return out

class PolicyUpdate(BaseModel):
    policies: dict

class OrgSettings(BaseModel):
    slack_webhook_url: Optional[str] = None
    alert_threshold: Optional[int] = None

async def get_org_settings() -> dict:
    doc = await db.org_settings.find_one({"key": "org"}, {"_id": 0})
    if not doc:
        doc = {"key": "org", "slack_webhook_url": "", "alert_threshold": 80}
        await db.org_settings.insert_one(dict(doc))
    return {"slack_webhook_url": doc.get("slack_webhook_url", ""),
            "alert_threshold": doc.get("alert_threshold", 80)}

def post_to_slack(url: str, text: str) -> bool:
    if not url.startswith("https://hooks.slack.com/"):
        logger.warning("blocked non-Slack webhook URL")
        return False
    try:
        r = requests.post(url, json={"text": text}, timeout=8, allow_redirects=False)
        return r.status_code < 300
    except Exception as e:
        logger.warning(f"slack post failed: {e}")
        return False

async def budget_snapshot(user: dict, scope: str) -> dict:
    if scope == "corporate" and user.get("role") != "compliance":
        scope = "personal"
    query = {} if scope == "corporate" else {"user_id": user["id"]}
    events = await fetch_events(query, 30)
    data = summarize(events)
    total_tokens = data["kpis"]["tokens_in"] + data["kpis"]["tokens_out"]
    budget = 60_000_000 if scope == "corporate" else (user.get("token_budget") or 5_000_000)
    used_pct = round(min(100, total_tokens / budget * 100), 1) if budget else 0
    remaining = max(0, budget - total_tokens)
    daily = total_tokens / 30
    days_left = round(remaining / daily, 1) if daily else None
    return {"scope": scope, "used": total_tokens, "budget": budget,
            "used_pct": used_pct, "remaining": remaining, "days_left": days_left}

async def make_notification(scope_key, ntype, severity, title, detail, dedupe_hours=12):
    since = (datetime.now(timezone.utc) - timedelta(hours=dedupe_hours)).isoformat()
    if await db.notifications.find_one({"scope_key": scope_key, "type": ntype, "title": title, "ts": {"$gte": since}}):
        return None
    doc = {"scope_key": scope_key, "type": ntype, "severity": severity, "title": title,
           "detail": detail, "read": False, "ts": datetime.now(timezone.utc).isoformat()}
    await db.notifications.insert_one(dict(doc))
    s = await get_org_settings()
    if s["slack_webhook_url"]:
        post_to_slack(s["slack_webhook_url"], f":rotating_light: *{title}*\n{detail}")
    return doc

@api_router.get("/cost/tool-risk")
async def tool_risk(user: dict = Depends(get_current_user)):
    tools = await compute_tool_risk()
    return {"tools": tools,
            "model_note": "Live score = sum of failing policy weights + recent-alert signal (0-100)."}

@api_router.get("/connectors/policies")
async def get_policies(user: dict = Depends(get_current_user)):
    return await compute_tool_risk()

@api_router.put("/connectors/policies/{tool}")
async def set_policy(tool: str, body: PolicyUpdate, user: dict = Depends(require_compliance)):
    doc = await db.connector_policies.find_one({"tool": tool})
    if not doc:
        raise HTTPException(status_code=404, detail="Connector not found")
    pol = doc["policies"]
    for k, v in body.policies.items():
        if k in POLICY_WEIGHTS:
            pol[k] = bool(v)
    await db.connector_policies.update_one({"tool": tool}, {"$set": {"policies": pol}})
    return await compute_tool_risk()

@api_router.get("/settings")
async def read_settings(user: dict = Depends(require_compliance)):
    return await get_org_settings()

@api_router.put("/settings")
async def write_settings(body: OrgSettings, user: dict = Depends(require_compliance)):
    updates = {}
    if body.slack_webhook_url is not None:
        url = body.slack_webhook_url.strip()
        if url and not url.startswith("https://hooks.slack.com/"):
            raise HTTPException(status_code=400, detail="Only https://hooks.slack.com/ webhook URLs are allowed.")
        updates["slack_webhook_url"] = url
    if body.alert_threshold is not None:
        updates["alert_threshold"] = max(1, min(100, int(body.alert_threshold)))
    await db.org_settings.update_one({"key": "org"}, {"$set": updates}, upsert=True)
    return await get_org_settings()

@api_router.post("/settings/test-slack")
async def test_slack(user: dict = Depends(require_compliance)):
    s = await get_org_settings()
    if not s["slack_webhook_url"]:
        raise HTTPException(status_code=400, detail="No Slack webhook configured")
    if not post_to_slack(s["slack_webhook_url"], ":shield: AegisAI test alert — Slack notifications are working."):
        raise HTTPException(status_code=502, detail="Slack webhook rejected the message")
    return {"ok": True}

@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    keys = [f"user:{user['id']}"]
    if user.get("role") == "compliance":
        keys.append("org")
    return await db.notifications.find({"scope_key": {"$in": keys}}, {"_id": 0}).sort("ts", -1).to_list(100)

@api_router.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    keys = [f"user:{user['id']}"]
    if user.get("role") == "compliance":
        keys.append("org")
    await db.notifications.update_many({"scope_key": {"$in": keys}}, {"$set": {"read": True}})
    return {"ok": True}

@api_router.post("/notifications/check")
async def check_notifications(user: dict = Depends(get_current_user)):
    s = await get_org_settings()
    threshold = s["alert_threshold"]
    created = []
    tb = await budget_snapshot(user, "personal")
    if tb["used_pct"] >= threshold:
        n = await make_notification(
            f"user:{user['id']}", "budget", "high" if tb["used_pct"] >= 95 else "medium",
            f"Token budget at {tb['used_pct']}%",
            f"You've used {tb['used']:,} of {tb['budget']:,} tokens (threshold {threshold}%)."
            + (f" ~{tb['days_left']} days left at current pace." if tb["days_left"] is not None else ""))
        if n:
            created.append(n)
    if user.get("role") == "compliance":
        tbo = await budget_snapshot(user, "corporate")
        if tbo["used_pct"] >= threshold:
            n = await make_notification(
                "org", "budget", "high" if tbo["used_pct"] >= 95 else "medium",
                f"Org token budget at {tbo['used_pct']}%",
                f"Org used {tbo['used']:,} of {tbo['budget']:,} tokens (threshold {threshold}%).")
            if n:
                created.append(n)
    return {"created": created}

async def run_all_budget_checks(run_id: str):
    if run_id and await db.cron_runs.find_one({"run_id": run_id}):
        return  # idempotent: already processed this delivery
    if run_id:
        await db.cron_runs.insert_one({"run_id": run_id, "ts": datetime.now(timezone.utc).isoformat()})
    s = await get_org_settings()
    threshold = s["alert_threshold"]
    users = await db.users.find({}).to_list(10000)
    for u in users:
        u["id"] = str(u["_id"])
        tb = await budget_snapshot(u, "personal")
        if tb["used_pct"] >= threshold:
            await make_notification(
                f"user:{u['id']}", "budget", "high" if tb["used_pct"] >= 95 else "medium",
                f"Token budget at {tb['used_pct']}%",
                f"You've used {tb['used']:,} of {tb['budget']:,} tokens (threshold {threshold}%)."
                + (f" ~{tb['days_left']} days left at current pace." if tb["days_left"] is not None else ""))
    compliance = await db.users.find_one({"role": "compliance"})
    if compliance:
        compliance["id"] = str(compliance["_id"])
        tbo = await budget_snapshot(compliance, "corporate")
        if tbo["used_pct"] >= threshold:
            await make_notification(
                "org", "budget", "high" if tbo["used_pct"] >= 95 else "medium",
                f"Org token budget at {tbo['used_pct']}%",
                f"Org used {tbo['used']:,} of {tbo['budget']:,} tokens (threshold {threshold}%).")

@api_router.post("/cron/budget-check")
async def cron_budget_check(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    run_id = request.headers.get("X-Webhook-Id") or (body.get("run_id") if isinstance(body, dict) else None)
    background.add_task(run_all_budget_checks, run_id or "")
    return {"accepted": True}

# ---------------------------------------------------------------------------
# Cost-efficiency Runbook (LLM generated, shareable)
# ---------------------------------------------------------------------------
@api_router.post("/cost/runbook")
async def generate_runbook(body: RunbookRequest, user: dict = Depends(get_current_user)):
    scope = body.scope
    if scope == "corporate" and user.get("role") != "compliance":
        scope = "personal"
    query = {} if scope == "corporate" else {"user_id": user["id"]}
    data = summarize(await fetch_events(query, 30))
    ctx = json.dumps({"kpis": data["kpis"], "by_app": data["by_app"],
                      "by_category": data["by_category"], "by_mode": data["by_mode"]}, default=str)
    system = ("You are an AI usage governance coach. Using the telemetry, write a practical, "
              "shareable COST-EFFICIENCY RUNBOOK that employees can follow to use generative-AI "
              "tools more efficiently and safely. Return STRICT JSON with keys: "
              "title (string), overview (1-2 sentences referencing real numbers), "
              "sections (array of 4-6 objects with keys heading and steps[array of strings]) "
              "covering token/cost reduction, choosing the right mode (Plan/Ask/Agent/Skills), "
              "prompt efficiency & fewer iterations, avoiding waste/regeneration, "
              "security/PII/license hygiene, and monitoring & budgets; "
              "do_dont (object with keys do[array] and dont[array]). "
              "Reference real numbers from the data. No markdown, JSON only.")
    try:
        prov, model = resolve_model(body.model)
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"runbook-{user['id']}",
                       system_message=system).with_model(prov, model)
        text = (await chat.send_message(UserMessage(text=f"Telemetry:\n{ctx}"))).strip()
        if text.startswith("```"):
            text = text.split("```")[1].replace("json", "", 1).strip()
        runbook = json.loads(text)
    except Exception as e:
        logger.warning(f"runbook failed: {e}")
        raise HTTPException(status_code=502, detail="Could not generate the runbook right now.")
    await db.runbooks.update_one({"scope": scope},
        {"$set": {"scope": scope, "runbook": runbook, "by": user["email"],
                  "model": body.model, "ts": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return runbook

@api_router.get("/cost/runbook")
async def get_runbook(scope: str = "personal", user: dict = Depends(get_current_user)):
    if scope == "corporate" and user.get("role") != "compliance":
        scope = "personal"
    doc = await db.runbooks.find_one({"scope": scope}, {"_id": 0})
    return doc or {}

# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------
async def seed_user_events(user_id: str, email: str, department: str = "Backend", days: int = 90):
    existing = await db.usage_events.count_documents({"user_id": user_id})
    if existing:
        return
    rng = random.Random(user_id)
    docs = []
    now = datetime.now(timezone.utc)
    for d in range(days):
        day = now - timedelta(days=d)
        for _ in range(rng.randint(1, 5)):
            app = rng.choice(APPS)
            mode = rng.choices(MODES, weights=[3, 4, 2, 1])[0]
            cat = rng.choice(CATEGORIES)
            tin = rng.randint(800, 9000)
            tout = rng.randint(400, 6000)
            cost = round((tin * 3 + tout * 15) / 1_000_000 * rng.uniform(0.8, 1.6), 4)
            code_lines = rng.randint(0, 220) if cat != "Learning & Upskilling" else rng.randint(0, 40)
            ai_lines = int(code_lines * rng.uniform(0.35, 0.85))
            docs.append({
                "user_id": user_id, "email": email, "app": app, "mode": mode,
                "category": cat, "department": department, "cost": cost,
                "tokens_in": tin, "tokens_out": tout, "code_lines": code_lines,
                "ai_lines": ai_lines, "accepted": int(ai_lines * rng.uniform(0.7, 1.0)),
                "suggested": int(code_lines * rng.uniform(1.0, 1.4)),
                "iterations": rng.randint(1, 5),
                "ts": day.replace(hour=rng.randint(8, 19)).isoformat(), "source": "seed",
            })
    if docs:
        await db.usage_events.insert_many(docs)

async def seed_org():
    if await db.users.count_documents({"role": "employee", "seeded_org": True}):
        return
    rng = random.Random("aegis-org")
    names = ["Aarav Shah", "Mia Chen", "Diego Ruiz", "Nour Haddad", "Priya Nair",
             "Tom Becker", "Lena Fischer", "Sam Okoye", "Yuki Tanaka", "Omar Farouk"]
    for i, n in enumerate(names):
        em = f"dev{i+1}@corp.internal"
        u = await db.users.find_one({"email": em})
        if not u:
            res = await db.users.insert_one({
                "email": em, "password_hash": hash_password("dev12345"), "name": n,
                "role": "employee", "seeded_org": True,
                "created_at": datetime.now(timezone.utc)})
            uid = str(res.inserted_id)
        else:
            uid = str(u["_id"])
        await seed_user_events(uid, em, department=rng.choice(DEPARTMENTS))

async def seed_alerts():
    if await db.alerts.count_documents({}):
        return
    now = datetime.now(timezone.utc)
    alerts = [
        {"severity": "high", "title": "Spend spike detected",
         "detail": "Codex CLI spend rose 214% vs 7-day baseline in DevOps, driven by Agent-mode refactors.",
         "category": "Anomaly", "ts": (now - timedelta(hours=3)).isoformat()},
        {"severity": "high", "title": "Possible PII in prompt",
         "detail": "3 prompts in Legal contained email/SSN-like patterns. Auto-redaction recommended.",
         "category": "PII", "ts": (now - timedelta(hours=9)).isoformat()},
        {"severity": "medium", "title": "GPL-licensed snippet suggested",
         "detail": "AI-suggested code matched a GPL-3.0 repository. Flag for license review before merge.",
         "category": "License", "ts": (now - timedelta(days=1)).isoformat()},
        {"severity": "medium", "title": "Shadow AI usage",
         "detail": "Traffic to an unsanctioned model endpoint observed from 2 accounts outside org connectors.",
         "category": "Shadow AI", "ts": (now - timedelta(days=1, hours=5)).isoformat()},
        {"severity": "low", "title": "Low prompt efficiency",
         "detail": "Data Science averaged 4.6 iterations/resolution vs org 2.3. Consider Plan-mode templates.",
         "category": "Efficiency", "ts": (now - timedelta(days=2)).isoformat()},
    ]
    await db.alerts.insert_many(alerts)

async def seed_policies():
    if await db.connector_policies.count_documents({}):
        return
    defaults = {
        "ChatGPT": {"sanctioned": True, "sso_required": True, "retention_off": True, "egress_restricted": True, "license_scan": True, "sandboxed": True},
        "Claude": {"sanctioned": True, "sso_required": True, "retention_off": True, "egress_restricted": True, "license_scan": True, "sandboxed": True},
        "Copilot": {"sanctioned": True, "sso_required": True, "retention_off": True, "egress_restricted": True, "license_scan": False, "sandboxed": False},
        "Codex CLI": {"sanctioned": True, "sso_required": True, "retention_off": True, "egress_restricted": False, "license_scan": True, "sandboxed": False},
        "Internal CLI": {"sanctioned": False, "sso_required": False, "retention_off": True, "egress_restricted": False, "license_scan": True, "sandboxed": False},
    }
    await db.connector_policies.insert_many([{"tool": t, "policies": p} for t, p in defaults.items()])

async def seed_notifications():
    if await db.notifications.count_documents({}):
        return
    now = datetime.now(timezone.utc)
    docs = [
        {"scope_key": "org", "type": "anomaly", "severity": "high", "title": "Codex CLI spend spike",
         "detail": "Agent-mode spend rose 214% vs baseline. Review before it impacts the monthly budget.",
         "read": False, "ts": (now - timedelta(hours=2)).isoformat()},
        {"scope_key": "org", "type": "budget", "severity": "medium", "title": "DevOps approaching 80% token budget",
         "detail": "DevOps has consumed 78% of its monthly token budget with ~6 days remaining.",
         "read": False, "ts": (now - timedelta(hours=5)).isoformat()},
    ]
    emp = await db.users.find_one({"email": os.environ["EMPLOYEE_EMAIL"].lower()})
    if emp:
        docs.append({"scope_key": f"user:{str(emp['_id'])}", "type": "efficiency", "severity": "low",
                     "title": "Tip: cut iterations to save tokens",
                     "detail": "Your avg iterations-to-resolution is above the org benchmark. Try Plan mode first to reduce regenerations.",
                     "read": False, "ts": (now - timedelta(hours=8)).isoformat()})
    await db.notifications.insert_many(docs)

async def seed_admin():
    for email, pw, role, name in [
        (os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "compliance", "Compliance Lead"),
        (os.environ["EMPLOYEE_EMAIL"], os.environ["EMPLOYEE_PASSWORD"], "employee", "Alex Employee"),
    ]:
        email = email.lower()
        existing = await db.users.find_one({"email": email})
        if not existing:
            res = await db.users.insert_one({
                "email": email, "password_hash": hash_password(pw), "name": name,
                "role": role, "created_at": datetime.now(timezone.utc)})
            uid = str(res.inserted_id)
        else:
            uid = str(existing["_id"])
        await seed_user_events(uid, email, department="Backend")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.usage_events.create_index("user_id")
    await db.notifications.create_index("scope_key")
    await seed_admin()
    await seed_org()
    await seed_alerts()
    await seed_policies()
    await seed_notifications()
    logger.info("AegisAI seeding complete")

@api_router.get("/")
async def root():
    return {"service": "AegisAI Governance API", "status": "ok"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
