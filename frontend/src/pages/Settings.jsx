import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, BACKEND_URL } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sliders, Download, ShieldOff, Copy, Check, Puzzle } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const openPlugin = async () => {
    try {
      const { data } = await api.get("/plugin/code");
      setCode(data.code);
      setOpen(true);
    } catch (_) { toast.error("Could not load plugin code"); }
  };

  const copyCode = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      toast.success("Plugin code copied — paste into a Studio Script");
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Couldn't copy — select the code and copy manually");
    }
  };

  return (
    <PageShell title="Settings" subtitle="Account, plugin, and privacy controls." icon={Sliders}>
      <div className="space-y-4 max-w-2xl">
        <div className="gb-glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Account</h3>
          <div className="space-y-2 text-sm">
            <Row label="Email" value={user?.email} />
            <Row label="Plan" value={user?.plan} />
            <Row label="Email verified" value={user?.email_verified ? "Yes" : "No"} />
            <Row label="Credits" value={String(user?.credits ?? 0)} />
          </div>
        </div>

        <div className="gb-glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1"><Puzzle size={16} className="text-gb-glow" /><h3 className="text-sm font-semibold text-white">GUI Blox Connect (Studio plugin)</h3></div>
          <p className="text-xs text-slate-400 mb-3">
            Paste this Luau into a Studio plugin Script, enable HTTP requests (Game Settings → Security → Allow HTTP Requests),
            then enter one of your API keys in the plugin widget. Backend URL is pre-filled: <span className="font-mono text-gb-glow">{BACKEND_URL}</span>
          </p>
          <Button data-testid="download-plugin-btn" onClick={openPlugin} className="bg-gb-violet hover:bg-gb-hover text-white rounded-xl">
            <Download size={15} className="mr-1.5" /> View plugin code
          </Button>
        </div>

        <div className="gb-glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1"><ShieldOff size={16} className="text-emerald-400" /><h3 className="text-sm font-semibold text-white">Zero Data Retention</h3></div>
          <p className="text-xs text-slate-400">Your prompts and generated code are never used to train external AI models. Storage is user-scoped and auto-purged per your plan's retention window.</p>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gb-surface border-purple-500/30 text-slate-100 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              GuiBloxConnect.server.lua
              <Button size="sm" data-testid="copy-plugin-code-btn" onClick={copyCode} className="bg-gb-violet hover:bg-gb-hover rounded-lg h-8">
                {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />} Copy
              </Button>
            </DialogTitle>
          </DialogHeader>
          <pre className="text-[11px] font-mono text-slate-300 bg-[#0A0A0F] border border-purple-500/25 rounded-xl p-4 max-h-[60vh] overflow-auto whitespace-pre">
            {code}
          </pre>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-purple-500/10 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono">{value}</span>
    </div>
  );
}
