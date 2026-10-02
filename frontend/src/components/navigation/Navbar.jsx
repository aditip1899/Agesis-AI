import { useAuth } from "@/context/AuthContext";
import { NavLink } from "react-router-dom";
import { ShieldCheck, Radio, User, Building2, Wallet, Bell } from "lucide-react";
import { AccountMenu } from "@/components/navigation/AccountMenu";

export function Navbar({ range, setRange }) {
  const { user } = useAuth();
  const isCompliance = user?.role === "compliance";

  const tabs = [
    { to: "/", label: "My Usage", slug: "my-usage", icon: User },
    { to: "/cost", label: "Cost & Runbook", slug: "cost-runbook", icon: Wallet },
    { to: "/alerts", label: "Alerts", slug: "alerts", icon: Bell },
  ];
  if (isCompliance) {
    tabs.push({ to: "/governance", label: "Org Governance", slug: "org-governance", icon: Building2 });
    tabs.push({ to: "/audit", label: "Audit Center", slug: "audit-center", icon: ShieldCheck });
  }

  const ranges = ["7d", "30d", "90d"];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          </div>
          <span className="font-display text-lg font-semibold text-slate-100">AegisAI</span>
        </div>

        <nav className="flex items-center gap-1" data-testid="main-nav">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end data-testid={`nav-${t.slug}`}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
                }`}>
              <t.icon className="h-4 w-4" /> <span className="hidden sm:inline">{t.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 md:flex">
            <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
            <span className="font-mono text-xs text-emerald-300">Live</span>
          </div>

          {setRange && (
            <div className="flex rounded-md border border-slate-700 bg-slate-900 p-0.5" data-testid="range-switch">
              {ranges.map((r) => (
                <button key={r} data-testid={`range-${r}`} onClick={() => setRange(r)}
                  className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                    range === r ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}>{r}</button>
              ))}
            </div>
          )}

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
