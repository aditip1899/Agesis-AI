import { useEffect, useState, useCallback } from "react";
import { api, apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { KpiCard, ChartCard, ChartTooltip, CHART_COLORS } from "@/components/charts";
import { ModelPicker } from "@/components/ModelPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";
import {
  Loader2, Gauge, Coins, TrendingDown, DollarSign, ShieldAlert, BookOpen, Copy, Check, AlertTriangle, Share2, FileDown, Printer,
} from "lucide-react";
import { toast } from "sonner";

const RISK_COLOR = { Low: "#10B981", Medium: "#F59E0B", High: "#F43F5E" };
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n);

export default function CostRunbook({ range }) {
  const { user } = useAuth();
  const isCompliance = user?.role === "compliance";
  const [scope, setScope] = useState("personal");
  const [data, setData] = useState(null);
  const [risk, setRisk] = useState([]);
  const [runbook, setRunbook] = useState(null);
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.get(`/cost/efficiency?scope=${scope}&range=${range}`).then((r) => setData(r.data));
    api.get(`/cost/tool-risk`).then((r) => setRisk(r.data.tools));
    api.get(`/cost/runbook?scope=${scope}`).then((r) => setRunbook(r.data?.runbook || null));
  }, [scope, range]);

  useEffect(() => { load(); }, [load]);

  const genRunbook = async () => {
    setBusy(true);
    try {
      const r = await api.post("/cost/runbook", { scope, model });
      setRunbook(r.data);
      toast.success("Cost-efficiency runbook generated");
    } catch (e) {
      toast.error(apiErr(e.response?.data?.detail) || "Failed to generate runbook");
    } finally { setBusy(false); }
  };

  const copyRunbook = () => {
    if (!runbook) return;
    const text = `${runbook.title}\n\n${runbook.overview}\n\n` +
      (runbook.sections || []).map((s) => `${s.heading}\n` + (s.steps || []).map((x) => `- ${x}`).join("\n")).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("Runbook copied — share with your team");
  };

  const buildMarkdown = () => {
    const date = new Date().toLocaleDateString();
    let md = `# 🛡️ AegisAI — ${runbook.title}\n\n`;
    md += `> Generative-AI Governance · Scope: **${scope === "corporate" ? "Organization" : "Personal"}** · Generated: ${date} · By: ${user?.name}\n\n`;
    md += `${runbook.overview}\n\n`;
    (runbook.sections || []).forEach((s, i) => {
      md += `## ${i + 1}. ${s.heading}\n\n`;
      (s.steps || []).forEach((x) => (md += `- ${x}\n`));
      md += "\n";
    });
    if (runbook.do_dont) {
      md += `## Do & Don't\n\n**Do**\n`;
      (runbook.do_dont.do || []).forEach((d) => (md += `- ✅ ${d}\n`));
      md += `\n**Don't**\n`;
      (runbook.do_dont.dont || []).forEach((d) => (md += `- ⛔ ${d}\n`));
      md += "\n";
    }
    md += `\n---\n_AegisAI Governance Platform · Publish this runbook to your team doc hub._\n`;
    return md;
  };

  const exportMarkdown = () => {
    const blob = new Blob([buildMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aegisai-runbook-${scope}.md`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Runbook exported as .md");
  };

  const printRunbook = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const secs = (runbook.sections || []).map((s, i) => `<h2>${i + 1}. ${s.heading}</h2><ul>${(s.steps || []).map((x) => `<li>${x}</li>`).join("")}</ul>`).join("");
    const dd = runbook.do_dont ? `<h2>Do &amp; Don't</h2><div class=dd><div><h3>Do</h3><ul>${(runbook.do_dont.do || []).map((d) => `<li>${d}</li>`).join("")}</ul></div><div><h3>Don't</h3><ul>${(runbook.do_dont.dont || []).map((d) => `<li>${d}</li>`).join("")}</ul></div></div>` : "";
    w.document.write(`<html><head><title>${runbook.title}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#0f172a;padding:0 24px}header{border-bottom:3px solid #3B82F6;padding-bottom:12px;margin-bottom:20px}h1{margin:0;font-size:24px}.meta{color:#64748b;font-size:13px;margin-top:6px}h2{color:#1e40af;margin-top:24px;font-size:17px}h3{margin-bottom:4px}.dd{display:flex;gap:32px}li{margin:4px 0}footer{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;color:#64748b;font-size:12px}</style></head><body><header><h1>🛡️ AegisAI — ${runbook.title}</h1><div class=meta>Scope: ${scope === "corporate" ? "Organization" : "Personal"} · Generated ${new Date().toLocaleDateString()} · By ${user?.name}</div></header><p>${runbook.overview}</p>${secs}${dd}<footer>AegisAI Governance Platform — publish to your team doc hub.</footer></body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => w.print(), 350);
  };

  const togglePolicy = async (tool, key, current) => {
    try {
      const r = await api.put(`/connectors/policies/${encodeURIComponent(tool)}`, { policies: { [key]: !current } });
      setRisk(r.data);
      toast.success("Policy updated — risk recomputed");
    } catch { toast.error("Failed to update policy"); }
  };

  if (!data) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  const k = data.kpis; const tb = data.token_budget;
  const budgetColor = tb.used_pct >= 85 ? "#F43F5E" : tb.used_pct >= 60 ? "#F59E0B" : "#10B981";

  return (
    <div className="space-y-6" data-testid="cost-runbook-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Cost Efficiency & Runbook</h1>
          <p className="mt-1 text-sm text-slate-400">Token budgets, cost-per-outcome, AI-tool risk and a shareable efficiency playbook.</p>
        </div>
        {isCompliance && (
          <div className="flex rounded-md border border-slate-700 bg-slate-900 p-0.5" data-testid="cost-scope-switch">
            {[{ id: "personal", label: "My Data" }, { id: "corporate", label: "Org" }].map((s) => (
              <button key={s.id} data-testid={`cost-scope-${s.id}`} onClick={() => setScope(s.id)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${scope === s.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      {tb.reminder && (
        <Card data-testid="budget-reminder" className="flex items-center gap-3 border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <div className="text-sm font-medium text-amber-200">Token budget reminder</div>
            <div className="text-xs text-amber-100/80">{tb.reminder}</div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard testid="kpi-eff-score" label="Efficiency Score" value={`${k.efficiency_score}`} sub={`${k.accept_rate}% accept · ${k.avg_iterations} iters`} icon={Gauge} accent="#10B981" />
        <KpiCard testid="kpi-cost-session" label="Cost / Session" value={`$${k.cost_per_session}`} sub={`$${k.total_cost} total`} icon={DollarSign} accent="#3B82F6" />
        <KpiCard testid="kpi-cost-line" label="Cost / Accepted Line" value={`$${k.cost_per_accepted_line}`} sub="lower is better" icon={TrendingDown} accent="#06B6D4" />
        <KpiCard testid="kpi-cost-hour" label="Cost / Hour Saved" value={`$${k.cost_per_hour_saved}`} sub={`~${k.hours_saved}h saved`} icon={Coins} accent="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard testid="token-budget-card" title="Token Budget" subtitle="Usage vs monthly budget">
          <div className="flex items-end justify-between">
            <div className="font-display text-3xl font-semibold text-slate-50">{tb.used_pct}%</div>
            <div className="text-right font-mono text-xs text-slate-400">
              {fmt(tb.used)} / {fmt(tb.budget)} tokens
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full transition-all" style={{ width: `${tb.used_pct}%`, background: budgetColor }} />
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <span className="text-slate-400">Remaining: <span className="font-mono text-slate-200">{fmt(tb.remaining)}</span></span>
            {tb.days_left != null && <span className="text-slate-400">~<span className="font-mono text-slate-200">{tb.days_left}</span> days left</span>}
          </div>
          <p className="mt-3 text-xs text-slate-500">Adjust your budget in Account settings.</p>
        </ChartCard>

        <ChartCard testid="cost-trend-card" title="Cost Trend" subtitle="Daily spend" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.trend}>
              <defs>
                <linearGradient id="ct" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} minTickGap={30} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip prefix="$" />} />
              <Area type="monotone" dataKey="cost" name="Cost" stroke="#10B981" strokeWidth={2} fill="url(#ct)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard testid="tool-risk-card" title="AI Tool Risk & Vulnerability" subtitle="Live risk = failing policy weights + recent-alert signal. Compliance can edit policies to recompute."
        right={<ShieldAlert className="h-4 w-4 text-rose-400" />}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={risk} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} />
            <YAxis type="category" dataKey="tool" tick={{ fill: "#94A3B8", fontSize: 12 }} width={90} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#1E293B55" }} />
            <Bar dataKey="score" name="Risk score" radius={[0, 6, 6, 0]}>
              {risk.map((t, i) => <Cell key={i} fill={RISK_COLOR[t.risk]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-3">
          {risk.map((t, i) => (
            <div key={i} data-testid={`risk-row-${i}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase" style={{ background: `${RISK_COLOR[t.risk]}22`, color: RISK_COLOR[t.risk] }}>{t.risk} · {t.score}</span>
                <span className="text-sm font-medium text-slate-100">{t.tool}</span>
                {t.alert_bump > 0 && <span className="font-mono text-[10px] text-amber-400">+{t.alert_bump} alert signal</span>}
              </div>
              <p className="mt-1 text-xs text-slate-400">{t.notes}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(t.policies || []).map((p) => (
                  <button key={p.key} data-testid={`policy-${t.tool}-${p.key}`} disabled={!isCompliance}
                    onClick={() => togglePolicy(t.tool, p.key, p.pass)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${p.pass ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"} ${isCompliance ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}>
                    {p.pass ? "✓" : "✕"} {p.label} ({p.weight})
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs leading-relaxed text-slate-500">
            Two lenses combined: <span className="text-slate-300">editable connector policies</span> — each failing control adds its weight —
            and a <span className="text-slate-300">live signal from recent alerts</span> (Shadow-AI, license, anomaly).
            {isCompliance ? " Toggle a policy chip to see the score update instantly." : " Ask compliance to adjust policies."}
          </p>
        </div>
      </ChartCard>

      <Card data-testid="runbook-card" className="border-slate-800 bg-gradient-to-br from-slate-900/90 to-emerald-950/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-400" />
            <h3 className="font-display text-base font-medium text-slate-100">Cost-Efficiency Runbook</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModelPicker value={model} onChange={setModel} testid="runbook-model" />
            {runbook && (
              <>
                <Button data-testid="copy-runbook" variant="outline" size="sm" onClick={copyRunbook}
                  className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">Copy</span>
                </Button>
                <Button data-testid="export-md" variant="outline" size="sm" onClick={exportMarkdown}
                  className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800">
                  <FileDown className="h-4 w-4" /><span className="ml-1.5 hidden sm:inline">.md</span>
                </Button>
                <Button data-testid="print-runbook" variant="outline" size="sm" onClick={printRunbook}
                  className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800">
                  <Printer className="h-4 w-4" /><span className="ml-1.5 hidden sm:inline">PDF</span>
                </Button>
              </>
            )}
            <Button data-testid="generate-runbook" size="sm" onClick={genRunbook} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (runbook ? "Regenerate" : "Generate")}
            </Button>
          </div>
        </div>

        {!runbook && !busy && (
          <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
            <Share2 className="h-8 w-8 text-slate-600" />
            <p className="mt-3 max-w-md text-sm text-slate-400">
              Generate an AI-authored, shareable runbook of best practices — tuned to {scope === "corporate" ? "your org's" : "your"} real usage —
              so every employee uses generative-AI tools cost-efficiently and safely.
            </p>
          </div>
        )}

        {runbook && (
          <div className="mt-4 space-y-5" data-testid="runbook-content">
            <div>
              <h4 className="font-display text-lg font-semibold text-slate-50">{runbook.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{runbook.overview}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(runbook.sections || []).map((s, i) => (
                <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 font-mono text-xs text-emerald-400">{i + 1}</span>
                    <h5 className="text-sm font-medium text-slate-100">{s.heading}</h5>
                  </div>
                  <ul className="space-y-1.5">
                    {(s.steps || []).map((step, j) => (
                      <li key={j} className="flex gap-2 text-xs text-slate-300"><span className="text-emerald-400">→</span> {step}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {runbook.do_dont && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-300"><Check className="h-4 w-4" /> Do</div>
                  <ul className="space-y-1">
                    {(runbook.do_dont.do || []).map((d, i) => <li key={i} className="text-xs text-slate-300">✓ {d}</li>)}
                  </ul>
                </div>
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-rose-300"><AlertTriangle className="h-4 w-4" /> Don't</div>
                  <ul className="space-y-1">
                    {(runbook.do_dont.dont || []).map((d, i) => <li key={i} className="text-xs text-slate-300">✕ {d}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
