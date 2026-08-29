import { Terminal as TermIcon, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/Brand";

export default function LogStreamPanel({ logEvents, wsOpen, lastError, onFix }) {
  return (
    <div className="rounded-xl border border-purple-500/25 bg-[#0B0B11] p-4 flex flex-col" data-testid="log-stream">
      <div className="flex items-center gap-2 mb-3">
        <TermIcon size={15} className="text-gb-glow" />
        <span className="font-semibold text-sm">Live Log Stream</span>
        <div className="ml-auto flex items-center gap-1.5">
          <StatusDot color={wsOpen ? "#8B5CF6" : "#64748B"} ping={wsOpen} />
          <span className="text-[10px] font-mono text-slate-500">{wsOpen ? "WS live" : "connecting"}</span>
        </div>
      </div>
      <div className="flex-1 max-h-52 overflow-y-auto space-y-1 font-mono text-[11px]">
        {logEvents.length === 0 && <div className="text-slate-600 py-4 text-center">Waiting for Studio events…</div>}
        {logEvents.map((e) => (
          <div key={e._id} className={`flex gap-2 ${e.level === "error" ? "text-red-400" : e.level === "warn" ? "text-amber-400" : "text-slate-400"}`}>
            <span className="text-slate-700">›</span>
            <span className="break-all">{e.message}</span>
          </div>
        ))}
      </div>
      {lastError && (
        <Button data-testid="fix-with-ai-btn" onClick={onFix} size="sm"
                className="mt-3 w-full bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 text-red-200 rounded-xl">
          <Wrench size={14} className="mr-1.5" /> Fix with AI
        </Button>
      )}
    </div>
  );
}
