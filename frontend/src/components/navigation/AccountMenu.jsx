import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, apiErr } from "@/lib/api";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, User2, ChevronDown, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AccountMenu() {
  const { user, setUser, logout } = useAuth();
  const isCompliance = user?.role === "compliance";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [budget, setBudget] = useState(user?.token_budget || (isCompliance ? 60000000 : 5000000));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch("/auth/profile", { name, token_budget: Number(budget) });
      setUser((u) => ({ ...u, ...data }));
      toast.success("Account updated");
      setOpen(false);
    } catch (e) {
      toast.error(apiErr(e.response?.data?.detail) || "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const initials = (user?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button data-testid="account-menu-trigger"
            className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 py-1 pl-1 pr-2 transition-colors hover:border-slate-500">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white ${isCompliance ? "bg-blue-600" : "bg-emerald-600"}`}>{initials}</span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-4 text-slate-200">{user?.name}</span>
              <span className={`block font-mono text-[10px] ${isCompliance ? "text-blue-400" : "text-emerald-400"}`}>{isCompliance ? "Compliance" : "Employee"}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 border-slate-700 bg-slate-900 text-slate-200">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-100">{user?.name}</span>
              <span className="text-xs text-slate-400">{user?.email}</span>
              <span className={`mt-1.5 w-fit rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${isCompliance ? "bg-blue-500/15 text-blue-300" : "bg-emerald-500/15 text-emerald-300"}`}>{isCompliance ? "Compliance Admin" : "Employee"}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem data-testid="open-settings" onClick={() => setOpen(true)} className="gap-2 focus:bg-slate-800">
            <Settings className="h-4 w-4" /> Account settings
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem data-testid="logout-btn" onClick={logout} className="gap-2 text-rose-300 focus:bg-slate-800 focus:text-rose-200">
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="settings-dialog" className="border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User2 className="h-4 w-4 text-blue-400" /> Account settings</DialogTitle>
            <DialogDescription className="text-slate-400">Manage your profile and monthly token budget.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-300">Display name</Label>
              <Input data-testid="settings-name" value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1.5 border-slate-700 bg-slate-950 text-slate-100" />
            </div>
            <div>
              <Label className="text-slate-300">Email</Label>
              <Input value={user?.email || ""} disabled className="mt-1.5 border-slate-800 bg-slate-950/50 text-slate-500" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-slate-300"><Coins className="h-3.5 w-3.5 text-amber-400" /> Monthly token budget</Label>
              <Input data-testid="settings-budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                className="mt-1.5 border-slate-700 bg-slate-950 text-slate-100" />
              <p className="mt-1 text-xs text-slate-500">Drives cost tracking and "budget about to run out" reminders.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700">Cancel</Button>
            <Button data-testid="settings-save" onClick={save} disabled={busy} className="bg-blue-600 hover:bg-blue-500">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
