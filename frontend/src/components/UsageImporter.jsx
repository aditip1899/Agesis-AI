import { useRef, useState } from "react";
import { api, apiErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function UsageImporter({ onImported }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/import", form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Imported ${res.data.inserted} usage events`);
      onImported?.();
    } catch (err) {
      toast.error(apiErr(err.response?.data?.detail) || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="usage-importer" className="border-dashed border-slate-700 bg-slate-900/50 p-5">
      <div className="flex items-center gap-2">
        <FileJson className="h-4 w-4 text-cyan-400" />
        <h3 className="font-display text-base font-medium text-slate-100">Import Usage</h3>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Drop a CSV / JSON export from OpenAI, Anthropic or a CLI log. Charts update instantly.
      </p>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
        className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-950/50 py-6 transition-colors hover:border-cyan-500/60"
        data-testid="import-dropzone"
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin text-cyan-400" /> : <Upload className="h-6 w-6 text-slate-500" />}
        <span className="mt-2 text-xs text-slate-400">Click or drag file here</span>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.json" hidden data-testid="import-file-input"
        onChange={(e) => upload(e.target.files?.[0])} />
      <Button variant="outline" size="sm" data-testid="import-browse"
        onClick={() => inputRef.current?.click()}
        className="mt-3 w-full border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800">
        Browse files
      </Button>
    </Card>
  );
}
