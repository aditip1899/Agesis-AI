import { Card } from "@/components/ui/card";

export const CHART_COLORS = ["#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6"];

export function KpiCard({ label, value, sub, accent = "#3B82F6", icon: Icon, testid }) {
  return (
    <Card
      data-testid={testid}
      className="relative overflow-hidden border-slate-800 bg-slate-900/70 p-5 transition-colors hover:border-slate-600"
    >
      <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full opacity-10" style={{ background: accent }} />
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" style={{ color: accent }} />}
        <span className="font-mono text-xs uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

export function ChartCard({ title, subtitle, children, right, testid, className = "" }) {
  return (
    <Card data-testid={testid} className={`border-slate-800 bg-slate-900/70 p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-display text-base font-medium text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 shadow-2xl">
      {label && <p className="mb-1 font-mono text-xs text-slate-400">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm text-slate-100">
          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="font-medium">{prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{suffix}</span>
        </p>
      ))}
    </div>
  );
}
