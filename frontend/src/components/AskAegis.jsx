import { useState, useRef, useEffect } from "react";
import { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";
import { ModelPicker } from "@/components/ModelPicker";
import { toast } from "sonner";

const SUGGESTIONS = [
  "What is driving my AI spend?",
  "How efficient is my AI code usage?",
  "Which category should I optimize?",
];

export function AskAegis() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState("gpt-5.4");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm Aegis Copilot. Ask me anything about your AI usage, spend or efficiency." },
  ]);
  const endRef = useRef(null);
  const scope = user?.role === "compliance" ? "corporate" : "personal";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setBusy(true);
    const setLast = (fn) => setMessages((m) => {
      const copy = [...m];
      copy[copy.length - 1] = { role: "assistant", content: fn(copy[copy.length - 1].content) };
      return copy;
    });
    try {
      const token = localStorage.getItem("aegis_token");
      const resp = await fetch(`${API}/assistant/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, scope, model }),
      });
      if (!resp.ok || !resp.body) throw new Error("stream failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const p of parts) {
          const line = p.replace(/^data: /, "").trim();
          if (!line) continue;
          let ev;
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.delta) setLast((c) => c + ev.delta);
          else if (ev.error) setLast(() => "Sorry, I couldn't reach the model right now.");
        }
      }
    } catch {
      toast.error("Assistant unavailable");
      setLast((c) => c || "Sorry, I couldn't reach the model right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        data-testid="ask-aegis-toggle"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-600/30 transition-transform hover:scale-105 hover:bg-blue-500"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {open && (
        <div
          data-testid="ask-aegis-panel"
          className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[92vw] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-3">
            <div className="relative">
              <Bot className="h-5 w-5 text-blue-400" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-100">Ask Aegis</div>
              <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <Sparkles className="h-2.5 w-2.5" /> {scope} scope
              </div>
            </div>
            <div className="ml-auto"><ModelPicker value={model} onChange={setModel} testid="assistant-model" /></div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="ask-aegis-messages">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "rounded-br-sm bg-blue-600 text-white"
                    : "rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-200"
                }`}>{m.content}</div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            {messages.length === 1 && (
              <div className="space-y-1.5 pt-2">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} data-testid={`ask-suggestion-${i}`} onClick={() => send(s)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:border-blue-500">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-slate-800 p-3">
            <Input
              data-testid="ask-aegis-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about your AI usage…"
              className="border-slate-700 bg-slate-950 text-slate-100"
            />
            <Button data-testid="ask-aegis-send" size="icon" onClick={() => send()} disabled={busy}
              className="shrink-0 bg-blue-600 hover:bg-blue-500">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
