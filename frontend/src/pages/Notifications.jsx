import { useEffect, useState, useCallback } from "react";
import { api, apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, CheckCheck, Loader2, RefreshCw, DollarSign, AlertTriangle, Gauge, Slack, Send } from "lucide-react";
import { toast } from "sonner";

const SEV = {
  high: { c: "#F43F5E", bg: "border-rose-500/40 bg-rose-500/10" },
  medium: { c: "#F59E0B", bg: "border-amber-500/40 bg-amber-500/10" },
  low: { c: "#06B6D4", bg: "border-cyan-500/40 bg-cyan-500/10" },
};
const ICON = { budget: DollarSign, anomaly: AlertTriangle, efficiency: Gauge };

export default function Notifications() {
  const { user } = useAuth();
  const isCompliance = user?.role === "compliance";
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [webhook, setWebhook] = useState("");
  const [threshold, setThreshold] = useState(80);

  const load = useCallback(() => {
    api.get("/notifications").then((r) => setItems(r.data));
    if (isCompliance) api.get("/settings").then((r) => { setWebhook(r.data.slack_webhook_url || ""); setThreshold(r.data.alert_threshold || 80); });
  }, [isCompliance]);
  useEffect(() => { load(); }, [load]);

  const check = async () => {
    setBusy(true);
    try {
      const r = await api.post("/notifications/check");
      toast.success(r.data.created.length ? `${r.data.created.length} new alert(s) raised` : "No new alerts — you're within budget");
      load();
    } catch { toast.error("Check failed"); } finally { setBusy(false); }
  };
  const markAll = async () => { await api.post("/notifications/read-all"); load(); toast.success("Marked all read"); };
  const saveSettings = async () => {
    try { await api.put("/settings", { slack_webhook_url: webhook, alert_threshold: Number(threshold) }); toast.success("Alert settings saved"); }
    catch { toast.error("Save failed"); }
  };
  const testSlack = async () => {
    try { await api.post("/settings/test-slack"); toast.success("Test message sent to Slack"); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail) || "Slack test failed"); }
  };

  if (!items) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Alerts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Budget, anomaly & efficiency notifications{isCompliance ? " · with Slack delivery" : ""}. {unread > 0 && <span className="text-blue-400">{unread} unread</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="check-budgets" size="sm" variant="outline" onClick={check} disabled={busy}
            className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}<span className="ml-1.5">Check budgets now</span>
          </Button>
          <Button data-testid="mark-all-read" size="sm" onClick={markAll} className="bg-blue-600 hover:bg-blue-500">
            <CheckCheck className="h-4 w-4" /><span className="ml-1.5">Mark all read</span>
          </Button>
        </div>
      </div>

      {isCompliance && (
        <Card data-testid="alert-settings" className="border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2"><Slack className="h-4 w-4 text-blue-400" /><h3 className="font-display text-base font-medium text-slate-100">Slack delivery & threshold</h3></div>
          <p className="mt-1 text-xs text-slate-400">Alerts fire when token usage crosses the threshold. Paste a Slack Incoming Webhook URL to also deliver to a channel.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <div><Label className="text-slate-300">Slack webhook URL</Label>
              <Input data-testid="slack-webhook" value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="mt-1.5 border-slate-700 bg-slate-950 text-slate-100" /></div>
            <div><Label className="text-slate-300">Threshold %</Label>
              <Input data-testid="alert-threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="mt-1.5 border-slate-700 bg-slate-950 text-slate-100" /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button data-testid="save-alert-settings" size="sm" onClick={saveSettings} className="bg-blue-600 hover:bg-blue-500">Save</Button>
            <Button data-testid="test-slack" size="sm" variant="outline" onClick={testSlack} className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"><Send className="h-4 w-4" /><span className="ml-1.5">Send test</span></Button>
          </div>
        </Card>
      )}

      <div className="space-y-3" data-testid="notifications-list">
        {items.length === 0 && (
          <Card className="border-slate-800 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            No alerts. You're within budget — tap "Check budgets now" to re-evaluate.
          </Card>
        )}
        {items.map((n, i) => {
          const sev = SEV[n.severity] || SEV.low;
          const Icon = ICON[n.type] || Bell;
          return (
            <Card key={i} data-testid={`notification-${i}`} className={`flex gap-4 border p-4 ${sev.bg} ${n.read ? "opacity-60" : ""}`}>
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${sev.c}22` }}>
                <Icon className="h-4 w-4" style={{ color: sev.c }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{n.title}</span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-blue-400" />}
                </div>
                <p className="mt-0.5 text-sm text-slate-300">{n.detail}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">{new Date(n.ts).toLocaleString()}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
