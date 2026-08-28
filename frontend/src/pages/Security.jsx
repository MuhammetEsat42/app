import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Monitor, ScrollText, LogOut } from "lucide-react";

export default function Security() {
  const [audit, setAudit] = useState([]);
  const [sessions, setSessions] = useState([]);

  const load = () => {
    api.get("/security/audit").then(({ data }) => setAudit(data));
    api.get("/security/sessions").then(({ data }) => setSessions(data));
  };
  useEffect(() => { load(); }, []);

  const revokeAll = async () => {
    await api.post("/security/sessions/revoke-all");
    toast.success("All other sessions revoked");
    load();
  };

  return (
    <PageShell title="Security & Audit" subtitle="Audit trail, active sessions, and key rotation." icon={ShieldCheck}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sessions */}
        <div className="gb-glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Monitor size={16} className="text-gb-glow" /><span className="font-semibold text-sm">Active Sessions</span></div>
            <Button size="sm" variant="ghost" onClick={revokeAll} data-testid="revoke-sessions-btn" className="text-red-400 hover:text-red-300 h-8">
              <LogOut size={14} className="mr-1" /> Revoke all
            </Button>
          </div>
          <div className="space-y-2" data-testid="sessions-list">
            {sessions.map((s) => (
              <div key={s.jti} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gb-elevated border border-purple-500/20">
                <span className="text-xs font-mono text-slate-400">{s.jti.slice(0, 8)}…</span>
                <span className="text-[11px] text-slate-500 font-mono">{new Date(s.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit log */}
        <div className="gb-glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><ScrollText size={16} className="text-gb-glow" /><span className="font-semibold text-sm">Audit Log</span></div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto" data-testid="audit-list">
            {audit.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gb-elevated border border-purple-500/15 text-xs">
                <span className="px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 font-mono text-[10px]">{a.action}</span>
                <span className="text-slate-500 font-mono ml-auto">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
