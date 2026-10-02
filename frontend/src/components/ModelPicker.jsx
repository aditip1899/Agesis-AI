import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ChevronDown, Check, Cpu } from "lucide-react";

export const MODELS = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "Claude" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Claude" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Claude" },
  { id: "gpt-5.4", label: "ChatGPT (gpt-5.4)", provider: "OpenAI" },
];

export function ModelPicker({ value, onChange, testid = "model-picker" }) {
  const cur = MODELS.find((m) => m.id === value) || MODELS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid={testid}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
        >
          <Cpu className="h-3 w-3 text-blue-400" />
          {cur.label}
          <ChevronDown className="h-3 w-3 text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-slate-700 bg-slate-900 text-slate-200">
        {MODELS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            data-testid={`model-opt-${m.id}`}
            onClick={() => onChange(m.id)}
            className="flex items-center justify-between gap-6 text-xs focus:bg-slate-800"
          >
            <span>
              <span className="text-slate-100">{m.label}</span>
              <span className="ml-1.5 text-slate-500">· {m.provider}</span>
            </span>
            {value === m.id && <Check className="h-3.5 w-3.5 text-blue-400" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
