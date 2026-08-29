import { Code2 } from "lucide-react";

export default function ContextBar({ context }) {
  const selection = context.selection || [];
  return (
    <div className="gb-glass rounded-xl p-3 flex items-center gap-2 flex-wrap" data-testid="context-bar">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">Context</span>
      {selection.length ? (
        selection.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-purple-950/40 border border-purple-500/40 text-purple-300">
            {s.split(".").pop()}
          </span>
        ))
      ) : (
        <span className="text-xs text-slate-500 font-mono">No selection synced</span>
      )}
      {context.open_script && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
          <Code2 size={12} /> {context.open_script}
        </span>
      )}
    </div>
  );
}
