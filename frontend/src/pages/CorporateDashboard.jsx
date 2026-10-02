import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { KpiCard, ChartCard, ChartTooltip, CHART_COLORS } from "@/components/charts";
import { InsightsPanel } from "@/components/InsightsPanel";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import { Card } from "@/components/ui/card";
import { DollarSign, Users, Code2, ShieldAlert, Loader2, Plug } from "lucide-react";

const CONNECTORS = [
  { name: "OpenAI / ChatGPT Team", status: "connected", color: "#10B981" },
  { name: "Codex CLI", status: "connected", color: "#10B981" },
  { name: "GitHub Copilot", status: "syncing", color: "#F59E0B" },
  { name: "Internal Terminal CLI", status: "connected", color: "#10B981" },
  { name: "Anthropic Claude", status: "disconnected", color: "#64748B" },
];

export default function CorporateDashboard({ range }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/corporate/summary?range=${range}`).then((r) => setData(r.data));
  }, [range]);

  if (!data) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  const k = data.kpis;
  const budgetPct = Math.min(100, Math.round((k.total_cost / k.monthly_budget) * 100));

  return (
    <div className="space-y-6" data-testid="corporate-dashboard">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Org AI Governance</h1>
        <p className="mt-1 text-sm text-slate-400">Company-wide generative-AI spend, code adoption and efficiency.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard testid="kpi-org-spend" label="Total AI Spend" value={`$${k.total_cost.toLocaleString()}`} sub={`${budgetPct}% of $${k.monthly_budget.toLocaleString()} budget`} icon={DollarSign} accent="#3B82F6" />
        <KpiCard testid="kpi-engineers" label="Active Engineers" value={k.active_engineers} sub={`${k.sessions} sessions`} icon={Users} accent="#06B6D4" />
        <KpiCard testid="kpi-org-ai-code" label="% AI-Generated Code" value={`${k.ai_code_pct}%`} sub={`${k.accept_rate}% acceptance`} icon={Code2} accent="#10B981" />
        <KpiCard testid="kpi-hours-saved" label="Est. Hours Saved" value={`${k.hours_saved}h`} sub={`${k.avg_iterations} avg iterations`} icon={ShieldAlert} accent="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard testid="chart-org-trend" title="Org Spend Trend" subtitle="Daily cost across all teams" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.trend}>
              <defs>
                <linearGradient id="osp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} minTickGap={30} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip prefix="$" />} />
              <Area type="monotone" dataKey="cost" name="Cost" stroke="#06B6D4" strokeWidth={2} fill="url(#osp)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard testid="chart-category-org" title="Category Distribution" subtitle="Org-wide work categories">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.by_category} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.by_category.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#0F172A" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<ChartTooltip prefix="$" />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard testid="dept-drilldown" title="Department Drilldown" subtitle="Spend, AI-code ratio & headcount by team">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="dept-table">
            <thead>
              <tr className="border-b border-slate-800 text-left font-mono text-xs uppercase tracking-wider text-slate-400">
                <th className="pb-2">Department</th>
                <th className="pb-2">Engineers</th>
                <th className="pb-2">Spend</th>
                <th className="pb-2 w-1/3">% AI-Generated Code</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.map((d, i) => (
                <tr key={i} className="border-b border-slate-800/60" data-testid={`dept-row-${i}`}>
                  <td className="py-3 font-medium text-slate-200">{d.department}</td>
                  <td className="py-3 text-slate-400">{d.engineers}</td>
                  <td className="py-3 font-mono text-slate-300">${d.cost.toLocaleString()}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full" style={{ width: `${d.ai_code_pct}%`, background: d.ai_code_pct > 65 ? "#F59E0B" : "#10B981" }} />
                      </div>
                      <span className="w-12 text-right font-mono text-xs text-slate-300">{d.ai_code_pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><InsightsPanel scope="corporate" range={range} /></div>
        <Card data-testid="connectors-panel" className="border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-blue-400" />
            <h3 className="font-display text-base font-medium text-slate-100">Live Connectors</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">Org-level API ingestion status.</p>
          <div className="mt-3 space-y-2">
            {CONNECTORS.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
                <span className="text-sm text-slate-300">{c.name}</span>
                <span className="flex items-center gap-1.5 font-mono text-xs capitalize" style={{ color: c.color }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
