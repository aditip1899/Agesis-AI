import { useState } from "react";
import { api, apiErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/ModelPicker";
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

const TONE = {
  positive: { icon: TrendingUp, color: "#10B981", bg: "bg-emerald-500/10 border-emerald-500/30" },
  warning: { icon: AlertTriangle, color: "#F59E0B", bg: "bg-amber-500/10 border-amber-500/30" },
  neutral: { icon: Info, color: "#3B82F6", bg: "bg-blue-500/10 border-blue-500/30" },
};

export function InsightsPanel({ scope, range }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState("claude-sonnet-4-6");

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.post("/insights", { scope, range, model });
      setData(res.data);
      toast.success("AI insights generated");
    } catch (err) {
      toast.error(apiErr(err.response?.data?.detail) || "Failed to generate insights");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="insights-panel" className="border-slate-800 bg-gradient-to-br from-slate-900/90 to-blue-950/30 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <h3 className="font-display text-base font-medium text-slate-100">AI Insights</h3>
        </div>
        <div className="flex items-center gap-2">
          <ModelPicker value={model} onChange={setModel} testid="insights-model" />
          <Button data-testid="generate-insights" size="sm" onClick={generate} disabled={busy}
            className="bg-blue-600 hover:bg-blue-500">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
          </Button>
        </div>
      </div>

      {!data && !busy && (
        <p className="mt-4 text-sm text-slate-400">
          Generate a natural-language read of your {scope === "corporate" ? "org" : ""} telemetry —
          spend trends, anomalies and recommendations.
        </p>
      )}

      {data && (
        <div className="mt-4 space-y-4" data-testid="insights-result">
          <p className="text-sm leading-relaxed text-slate-200">{data.summary}</p>
          <div className="space-y-2">
            {data.insights?.map((it, i) => {
              const t = TONE[it.tone] || TONE.neutral;
              const Icon = t.icon;
              return (
                <div key={i} className={`flex gap-3 rounded-lg border p-3 ${t.bg}`}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: t.color }} />
                  <div>
                    <div className="text-sm font-medium text-slate-100">{it.title}</div>
                    <div className="mt-0.5 text-xs text-slate-300">{it.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {data.recommendations?.length > 0 && (
            <div>
              <p className="mb-1.5 font-mono text-xs uppercase tracking-wider text-slate-400">Recommendations</p>
              <ul className="space-y-1">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-300">
                    <span className="text-blue-400">→</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
