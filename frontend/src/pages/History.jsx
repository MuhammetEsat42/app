import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageShell } from "@/components/PageShell";
import { History as HistoryIcon, Zap } from "lucide-react";

export default function History() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/history").then(({ data }) => setItems(data)); }, []);

  return (
    <PageShell title="Prompt History" subtitle="Retention by plan — Free/Pro 30 days, Studio unlimited." icon={HistoryIcon}>
      <div className="space-y-3" data-testid="history-list">
        {items.length === 0 && <div className="gb-glass rounded-xl p-10 text-center text-slate-500 text-sm">No prompts yet.</div>}
        {items.map((h) => (
          <div key={h.id} className="gb-glass rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-200 flex-1">{h.prompt}</p>
              <span className="inline-flex items-center gap-1 text-xs font-mono text-gb-glow shrink-0">
                <Zap size={12} className="fill-current" /> {h.credits_used}c
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500 font-mono">{new Date(h.created_at).toLocaleString()}</span>
              {(h.actions || []).map((a, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/40 text-purple-300 font-mono">{a.tool}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
