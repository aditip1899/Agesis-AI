import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { KpiCard, ChartCard, ChartTooltip, CHART_COLORS } from "@/components/charts";
import { InsightsPanel } from "@/components/InsightsPanel";
import { UsageImporter } from "@/components/UsageImporter";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar, Legend,
} from "recharts";
import { DollarSign, Cpu, Code2, Gauge, Loader2 } from "lucide-react";

export default function PersonalDashboard({ range }) {
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get(`/personal/summary?range=${range}`).then((r) => setData(r.data));
  }, [range]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  const k = data.kpis;

  return (
    <div className="space-y-6" data-testid="personal-dashboard">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">My AI Usage</h1>
        <p className="mt-1 text-sm text-slate-400">Personal generative-AI telemetry across ChatGPT, Codex and CLI.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard testid="kpi-spend-total" label="Total Spend" value={`$${k.total_cost}`} sub={`${k.sessions} sessions`} icon={DollarSign} accent="#3B82F6" />
        <KpiCard testid="kpi-tokens" label="Tokens" value={`${((k.tokens_in + k.tokens_out) / 1000).toFixed(0)}K`} sub={`${(k.tokens_in / 1000).toFixed(0)}K in / ${(k.tokens_out / 1000).toFixed(0)}K out`} icon={Cpu} accent="#06B6D4" />
        <KpiCard testid="kpi-ai-code" label="AI-Authored Code" value={`${k.ai_code_pct}%`} sub={`${k.accept_rate}% accepted`} icon={Code2} accent="#10B981" />
        <KpiCard testid="kpi-efficiency" label="Efficiency" value={`${k.avg_iterations} iters`} sub={`~${k.hours_saved}h saved`} icon={Gauge} accent="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard testid="chart-spend-trend" title="Spend Trend" subtitle="Daily cost across all AI apps" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.trend}>
              <defs>
                <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} minTickGap={30} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip prefix="$" />} />
              <Area type="monotone" dataKey="cost" name="Cost" stroke="#3B82F6" strokeWidth={2} fill="url(#sp)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard testid="chart-category" title="Category Split" subtitle="Where your AI spend goes">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.by_category} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.by_category.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#0F172A" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<ChartTooltip prefix="$" />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {data.by_category.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {c.name}
                </span>
                <span className="font-mono text-slate-400">${c.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard testid="chart-mode" title="Mode Usage" subtitle="Plan · Ask · Agent · Skills">
          <ResponsiveContainer width="100%" height={240}>
            <RadialBarChart innerRadius="25%" outerRadius="100%" data={data.by_mode.map((m, i) => ({ ...m, fill: CHART_COLORS[i % CHART_COLORS.length] }))} startAngle={90} endAngle={-270}>
              <RadialBar background dataKey="value" cornerRadius={6} />
              <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} />
              <Tooltip content={<ChartTooltip prefix="$" />} />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard testid="chart-by-app" title="Spend by App" subtitle="ChatGPT · Codex · CLI · Claude" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.by_app} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} width={90} />
              <Tooltip content={<ChartTooltip prefix="$" />} cursor={{ fill: "#1E293B55" }} />
              <Bar dataKey="value" name="Spend" radius={[0, 6, 6, 0]}>
                {data.by_app.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><InsightsPanel scope="personal" range={range} /></div>
        <UsageImporter onImported={load} />
      </div>
    </div>
  );
}
