import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles, Zap, XCircle, CheckCircle2, CircleDashed, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/Brand";
import { toolMeta } from "@/lib/toolMeta";

function ActionCard({ action, status }) {
  const meta = toolMeta(action.tool);
  const Icon = meta.icon;
  const a = action.args || {};
  const subtitle = a.name || a.query || a.target || a.asset || a.biome || a.class_name || "—";
  return (
    <div data-testid={`action-${action.tool}`}
         className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0A0A0F] border border-purple-500/15">
      <Icon size={16} style={{ color: meta.color }} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">{meta.label}</span>
          <span className="text-[10px] font-mono text-gb-glow">{action.cost}c</span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono truncate">{subtitle}</div>
      </div>
      <div className="shrink-0">
        {status === "done" && <CheckCircle2 size={15} className="text-emerald-400" />}
        {status === "error" && <XCircle size={15} className="text-red-400" />}
        {status === "in_progress" && <Loader2 size={15} className="text-amber-400 animate-spin" />}
        {(!status || status === "queued") && <CircleDashed size={15} className="text-slate-500" />}
      </div>
    </div>
  );
}

export default function PlanStream({ planText, actions, statusMap, running, hardStop, onBuyCredits }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [planText, actions]);

  if (!planText && actions.length === 0 && !running) return null;

  return (
    <div className="gb-glass rounded-xl p-4 flex flex-col" data-testid="ai-plan-stream">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-gb-violet" />
        <span className="font-semibold text-sm">Action Plan</span>
        {running && <StatusDot color="#8B5CF6" />}
      </div>
      <div ref={ref} className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
        {hardStop && (
          <div data-testid="hard-stop-banner" className="p-3 rounded-lg bg-red-950/40 border border-red-500/40">
            <div className="text-xs font-semibold text-red-200 flex items-center gap-1.5">
              <XCircle size={14} /> Out of credits
            </div>
            <p className="text-[11px] text-red-300/80 mt-1">
              This action needed {hardStop.needed} credits, you have {hardStop.remaining}. No further actions were queued.
            </p>
            <Button data-testid="buy-credits-cta" size="sm" onClick={onBuyCredits}
                    className="mt-2 h-7 text-xs bg-red-900/50 hover:bg-red-800/60 border border-red-500/40 text-red-100 rounded-lg">
              <Zap size={12} className="mr-1 fill-current" /> Buy credits
            </Button>
          </div>
        )}
        {planText && (
          <div className="text-xs text-slate-300 leading-relaxed gb-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{planText}</ReactMarkdown>
            {running && <span className="gb-blink">▍</span>}
          </div>
        )}
        {actions.map((a) => (
          <ActionCard key={a.command_id} action={a} status={statusMap[a.command_id]} />
        ))}
      </div>
    </div>
  );
}
