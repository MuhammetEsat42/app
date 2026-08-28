import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KeyRound, Plus, Copy, Trash2, RefreshCw, ShieldAlert, Check, Globe } from "lucide-react";

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [revealed, setRevealed] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editAllow, setEditAllow] = useState("");

  const load = async () => {
    const { data } = await api.get("/keys");
    setKeys(data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) { toast.error("Name your key"); return; }
    try {
      const ip = allowlist.split(",").map((s) => s.trim()).filter(Boolean);
      const { data } = await api.post("/keys", { name, ip_allowlist: ip });
      setRevealed(data.full_key);
      setName(""); setAllowlist("");
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const revoke = async (id) => {
    await api.post(`/keys/${id}/revoke`);
    toast.success("Key revoked");
    load();
  };

  const regenerate = async (id) => {
    const { data } = await api.post(`/keys/${id}/regenerate`);
    setRevealed(data.full_key);
    setOpen(true);
    load();
  };

  const saveIps = async (id) => {
    const ip = editAllow.split(",").map((s) => s.trim()).filter(Boolean);
    await api.put(`/keys/${id}`, { ip_allowlist: ip });
    toast.success("IP allowlist updated");
    setEditing(null);
    load();
  };

  return (
    <PageShell
      title="API & Bridge Keys"
      subtitle="Argon2id-hashed keys for GUI Blox Connect. Shown in full once — store securely."
      icon={KeyRound}
      actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setRevealed(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="new-key-btn" className="bg-gb-violet hover:bg-gb-hover text-white rounded-xl">
              <Plus size={16} className="mr-1.5" /> New Key
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gb-surface border-purple-500/30 text-slate-100">
            <DialogHeader>
              <DialogTitle>{revealed ? "Copy your key now" : "Generate API key"}</DialogTitle>
            </DialogHeader>
            {revealed ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                  <ShieldAlert size={16} /> This is the only time the full key is shown.
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0A0A0F] border border-purple-500/30 font-mono text-xs break-all">
                  <span data-testid="revealed-key" className="flex-1 text-gb-glow">{revealed}</span>
                  <Button size="sm" variant="ghost" data-testid="copy-key-btn"
                          onClick={async () => { const ok = await copyToClipboard(revealed); if (ok) { setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); } else { toast.error("Copy failed — select manually"); } }}>
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </Button>
                </div>
                <Button className="w-full bg-gb-violet hover:bg-gb-hover rounded-xl" onClick={() => { setOpen(false); setRevealed(null); }}>Done</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-400">Key name</Label>
                  <Input data-testid="key-name-input" value={name} onChange={(e) => setName(e.target.value)}
                         placeholder="Studio — MacBook" className="mt-1.5 bg-[#0A0A0F] border-purple-500/25" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-400">IP allowlist (optional, CIDR)</Label>
                  <Textarea data-testid="key-allowlist-input" value={allowlist} onChange={(e) => setAllowlist(e.target.value)}
                            placeholder="203.0.113.4, 10.0.0.0/24" rows={2}
                            className="mt-1.5 bg-[#0A0A0F] border-purple-500/25 font-mono text-xs" />
                  <p className="text-[11px] text-slate-500 mt-1">Empty = open to all IPs. Recommended for Pro/Studio.</p>
                </div>
                <DialogFooter>
                  <Button data-testid="create-key-submit" onClick={create} className="bg-gb-violet hover:bg-gb-hover rounded-xl w-full">Generate key</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-3" data-testid="keys-list">
        {keys.length === 0 && (
          <div className="gb-glass rounded-xl p-10 text-center text-slate-500 text-sm">
            No keys yet. Generate one to connect GUI Blox Connect.
          </div>
        )}
        {keys.map((k) => (
          <div key={k.id} data-testid={`key-row-${k.id}`}
               className={`gb-glass rounded-xl p-4 ${k.revoked ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-500/30 grid place-items-center">
                  <KeyRound size={18} className="text-gb-glow" />
                </div>
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {k.name}
                    {k.revoked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/50 text-red-400 font-mono">REVOKED</span>}
                  </div>
                  <div className="font-mono text-xs text-slate-500">{k.masked}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                <span>last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</span>
                {!k.revoked && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" data-testid={`edit-ip-${k.id}`}
                            onClick={() => { setEditing(k.id); setEditAllow((k.ip_allowlist || []).join(", ")); }}
                            className="h-8 text-slate-400 hover:text-white"><Globe size={14} /></Button>
                    <Button size="sm" variant="ghost" data-testid={`regen-${k.id}`}
                            onClick={() => regenerate(k.id)} className="h-8 text-slate-400 hover:text-white"><RefreshCw size={14} /></Button>
                    <Button size="sm" variant="ghost" data-testid={`revoke-${k.id}`}
                            onClick={() => revoke(k.id)} className="h-8 text-red-400 hover:text-red-300"><Trash2 size={14} /></Button>
                  </div>
                )}
              </div>
            </div>

            {editing === k.id && (
              <div className="mt-3 flex items-center gap-2">
                <Input value={editAllow} onChange={(e) => setEditAllow(e.target.value)}
                       placeholder="CIDR list…" className="bg-[#0A0A0F] border-purple-500/25 font-mono text-xs" />
                <Button size="sm" onClick={() => saveIps(k.id)} className="bg-gb-violet hover:bg-gb-hover rounded-lg">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            )}
            {editing !== k.id && k.ip_allowlist?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {k.ip_allowlist.map((ip, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/40 text-cyan-300 font-mono">{ip}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  );
}
