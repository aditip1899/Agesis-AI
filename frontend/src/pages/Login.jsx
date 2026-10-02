import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

const HERO = "https://images.unsplash.com/photo-1590065707046-4fde65275b2e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Signed in to AegisAI");
    } catch (err) {
      toast.error(apiErr(err.response?.data?.detail) || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const quick = (em, pw) => { setEmail(em); setPassword(pw); };

  return (
    <div className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={HERO} alt="Compliance governance" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/70 to-blue-950/40" />
        <div className="absolute bottom-0 p-12">
          <div className="flex items-center gap-2 text-blue-400">
            <ShieldCheck className="h-6 w-6" />
            <span className="font-display text-lg font-semibold text-slate-100">AegisAI</span>
          </div>
          <h2 className="mt-4 max-w-md font-display text-3xl font-semibold leading-tight text-slate-50">
            Govern generative-AI spend, code and efficiency across your org.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-slate-400">
            Track ChatGPT, Codex & CLI usage. Measure AI-authored code, catch spend spikes,
            and give compliance forensic guardrails — without slowing engineers down.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 aegis-grid-bg">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
            <span className="font-display text-xl font-semibold text-slate-100">AegisAI</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-slate-50">Sign in</h1>
          <p className="mt-1 text-sm text-slate-400">Access your governance command center.</p>

          <div className="mt-6 space-y-4">
            <div>
              <Label className="text-slate-300">Work email</Label>
              <Input data-testid="login-email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@corp.internal"
                className="mt-1.5 border-slate-700 bg-slate-900 text-slate-100" />
            </div>
            <div>
              <Label className="text-slate-300">Password</Label>
              <Input data-testid="login-password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="mt-1.5 border-slate-700 bg-slate-900 text-slate-100" />
            </div>
            <Button data-testid="login-submit" type="submit" disabled={busy}
              className="w-full bg-blue-600 font-medium hover:bg-blue-500">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </div>

          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-slate-400">
              <Activity className="h-3 w-3" /> Demo accounts
            </p>
            <button type="button" data-testid="demo-compliance"
              onClick={() => quick("compliance@corp.internal", "compliance123")}
              className="mb-1.5 w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-left text-xs text-slate-300 hover:border-blue-500">
              <span className="font-medium text-blue-400">Compliance Admin</span> — compliance@corp.internal
            </button>
            <button type="button" data-testid="demo-employee"
              onClick={() => quick("employee@corp.internal", "employee123")}
              className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-left text-xs text-slate-300 hover:border-blue-500">
              <span className="font-medium text-emerald-400">Employee</span> — employee@corp.internal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
