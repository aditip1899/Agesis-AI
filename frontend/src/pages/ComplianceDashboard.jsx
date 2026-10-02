import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ShieldAlert, AlertTriangle, FileWarning, EyeOff, Gauge, Loader2, ShieldCheck } from "lucide-react";

const ICONS = { Anomaly: AlertTriangle, PII: EyeOff, License: FileWarning, "Shadow AI": ShieldAlert, Efficiency: Gauge };
const SEV = {
  high: { label: "High", color: "#F43F5E", bg: "border-rose-500/40 bg-rose-500/10" },
  medium: { label: "Medium", color: "#F59E0B", bg: "border-amber-500/40 bg-amber-500/10" },
  low: { label: "Low", color: "#06B6D4", bg: "border-cyan-500/40 bg-cyan-500/10" },
};

export default function ComplianceDashboard() {
  const [alerts, setAlerts] = useState(null);

  useEffect(() => { api.get("/compliance/alerts").then((r) => setAlerts(r.data)); }, []);

  if (!alerts) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  const counts = alerts.reduce((a, x) => ({ ...a, [x.severity]: (a[x.severity] || 0) + 1 }), {});

  return (
    <div className="space-y-6" data-testid="compliance-dashboard">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Compliance Audit Center</h1>
        <p className="mt-1 text-sm text-slate-400">Anomaly, PII, license & shadow-AI guardrails with natural-language explainers.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {["high", "medium", "low"].map((s) => (
          <Card key={s} data-testid={`alert-count-${s}`} className={`border p-4 ${SEV[s].bg}`}>
            <div className="font-display text-3xl font-semibold" style={{ color: SEV[s].color }}>{counts[s] || 0}</div>
            <div className="mt-1 font-mono text-xs uppercase tracking-wider text-slate-300">{SEV[s].label} alerts</div>
          </Card>
        ))}
        <Card className="border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-1.5 font-display text-3xl font-semibold text-emerald-400"><ShieldCheck className="h-6 w-6" />94%</div>
          <div className="mt-1 font-mono text-xs uppercase tracking-wider text-slate-300">Guardrail pass rate</div>
        </Card>
      </div>

      <div className="space-y-3" data-testid="alerts-list">
        {alerts.map((a, i) => {
          const sev = SEV[a.severity] || SEV.low;
          const Icon = ICONS[a.category] || AlertTriangle;
          return (
            <Card key={i} data-testid={`alert-${i}`} className={`border p-4 transition-colors hover:border-slate-600 ${sev.bg}`}>
              <div className="flex gap-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${sev.color}22` }}>
                  <Icon className="h-4 w-4" style={{ color: sev.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-100">{a.title}</span>
                    <span className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ background: `${sev.color}22`, color: sev.color }}>{a.category}</span>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">{sev.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{a.detail}</p>
                  <p className="mt-1.5 font-mono text-[11px] text-slate-500">{new Date(a.ts).toLocaleString()}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
