import { Cpu, Zap, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SUGGESTIONS } from "@/lib/toolMeta";

export default function PromptComposer({ prompt, setPrompt, estimate, running, canRun, showSuggestions, onRun }) {
  return (
    <div className="gb-glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu size={16} className="text-gb-glow" />
        <span className="font-semibold text-sm">AI Workspace</span>
        <span className="ml-auto text-[11px] font-mono text-slate-500">Claude Sonnet 4.6</span>
      </div>
      <Textarea
        data-testid="prompt-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what to build — instances, Luau, UI, terrain, scatter…"
        rows={4}
        className="bg-[#0A0A0F] border-purple-500/25 focus-visible:ring-gb-violet resize-none font-mono text-sm"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onRun(); }}
      />

      <div className="flex items-center justify-between mt-3 gap-2">
        <div data-testid="credit-estimate" className="text-xs text-slate-400 flex items-center gap-1.5">
          {estimate ? (
            <>
              <Zap size={13} className="text-gb-glow fill-current" />
              <span className="text-gb-glow font-semibold">~{estimate.estimate}+</span> credits <span className="text-slate-600">(min)</span>
              {estimate.hints?.length > 0 && <span className="text-slate-500 hidden sm:inline">· {estimate.hints.join(", ")}</span>}
            </>
          ) : <span className="text-slate-600">Cost preview appears as you type</span>}
        </div>
        <Button data-testid="run-prompt-btn" onClick={onRun} disabled={running || !canRun}
                className="bg-gb-violet hover:bg-gb-hover text-white font-semibold rounded-xl">
          {running ? <Loader2 className="animate-spin" size={16} /> : <><Send size={15} className="mr-1.5" /> Generate</>}
        </Button>
      </div>

      {showSuggestions && (
        <div className="mt-4 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-600 font-mono mb-1">Try</div>
          {SUGGESTIONS.map((s, i) => (
            <button key={s} data-testid={`suggestion-${i}`} onClick={() => setPrompt(s)}
                    className="w-full text-left text-xs text-slate-400 hover:text-slate-100 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-purple-500/20">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
