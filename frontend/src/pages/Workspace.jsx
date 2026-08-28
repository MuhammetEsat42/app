import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { streamPrompt, api } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { useAuth } from "@/context/AuthContext";
import { useLogStream } from "@/hooks/useLogStream";
import LuauEditor from "@/components/LuauEditor";
import TerrainPreview from "@/components/TerrainPreview";
import { StatusDot } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Send, Loader2, Zap, Cpu, CheckCircle2, CircleDashed, XCircle, Copy, Wrench,
  Boxes, FileCode2, Mountain, Trees, Search, Terminal as TermIcon, Code2, Sparkles,
} from "lucide-react";

const TOOL_META = {
  create_instance: { icon: Boxes, label: "Create Instance", color: "#38BDF8" },
  modify_property: { icon: Sparkles, label: "Modify Property", color: "#A78BFA" },
  write_script: { icon: FileCode2, label: "Write Luau", color: "#4ADE80" },
  search_toolbox: { icon: Search, label: "Toolbox Search", color: "#FBBF24" },
  insert_toolbox_model: { icon: Boxes, label: "Insert Model", color: "#FBBF24" },
  sculpt_terrain: { icon: Mountain, label: "Sculpt Terrain", color: "#06B6D4" },
  paint_terrain_material: { icon: Mountain, label: "Paint Biome", color: "#F59E0B" },
  scatter_assets: { icon: Trees, label: "Scatter Assets", color: "#22C55E" },
  create_animation: { icon: Sparkles, label: "Create Animation", color: "#F472B6" },
};

const SUGGESTIONS = [
  "Create a red neon Beacon part with a pulsing transparency ModuleScript",
  "Build a main menu ScreenGui with Play, Settings and Quit buttons",
  "Generate a sakura forest map: sculpt terrain, paint grass biome, scatter 200 sakura trees and gravel",
  "Write a strict-typed sprint system LocalScript using ContextActionService",
  "Animate a floating platform that bobs up and down and slowly rotates forever",
];

export default function Workspace() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { events, studioConnected, context, wsOpen } = useLogStream();
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [planText, setPlanText] = useState("");
  const [actions, setActions] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [estimate, setEstimate] = useState(null);
  const [activeScript, setActiveScript] = useState(null);
  const [hardStop, setHardStop] = useState(null);
  const abortRef = useRef(null);
  const planRef = useRef(null);

  // command status updates from WS
  useEffect(() => {
    for (const e of events) {
      if (e.type === "command_status") {
        setStatusMap((m) => ({ ...m, [e.command_id]: e.status }));
      }
    }
  }, [events]);

  useEffect(() => { planRef.current?.scrollTo(0, planRef.current.scrollHeight); }, [planText, actions]);

  // debounced credit estimate
  useEffect(() => {
    if (!prompt.trim()) { setEstimate(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/workspace/estimate", { prompt });
        setEstimate(data);
      } catch (_) {}
    }, 500);
    return () => clearTimeout(t);
  }, [prompt]);

  const scripts = useMemo(
    () => actions.filter((a) => a.tool === "write_script").map((a) => ({ id: a.command_id, ...a.args })),
    [actions]
  );
  const toolboxSearches = useMemo(() => actions.filter((a) => a.tool === "search_toolbox"), [actions]);
  const terrainOps = useMemo(
    () => actions.filter((a) => ["sculpt_terrain", "paint_terrain_material", "scatter_assets"].includes(a.tool)),
    [actions]
  );

  const displayScript = activeScript || scripts[scripts.length - 1] || null;

  const logEvents = events.filter((e) => e.type === "log" || e.type === "connected" || e.type === "studio_status");
  const lastError = [...events].reverse().find((e) => e.type === "log" && e.level === "error" && e.fixable);

  const run = async (overridePrompt) => {
    const p = overridePrompt || prompt;
    if (!p.trim()) return;
    if ((user?.credits ?? 0) <= 0) { toast.error("No credits remaining. Buy a credit pack."); return; }
    setRunning(true);
    setPlanText("");
    setActions([]);
    setStatusMap({});
    setHardStop(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamPrompt({ prompt: p, context }, (ev) => {
        if (ev.type === "token") setPlanText((t) => t + ev.content);
        else if (ev.type === "action") setActions((a) => [...a, ev]);
        else if (ev.type === "hard_stop") {
          setHardStop({ needed: ev.needed, remaining: ev.remaining });
          toast.error("Hard stop: insufficient credits.");
        }
        else if (ev.type === "error") toast.error(ev.message);
        else if (ev.type === "done") {
          if (ev.action_count > 0) toast.success(`Plan queued — ${ev.action_count} action(s), ${ev.credits_used} credits.`);
          refreshUser();
        }
      }, controller.signal);
    } catch (e) {
      toast.error(e.message || "Prompt failed");
    } finally {
      setRunning(false);
    }
  };

  const fixWithAI = () => {
    if (!lastError) return;
    const fixPrompt = `A runtime error occurred in Studio:\n"${lastError.message}"\nDiagnose the root cause and write corrected strict-typed Luau to fix it.`;
    setPrompt(fixPrompt);
    run(fixPrompt);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-6">
      {/* ---------------- LEFT: Prompt + Plan ---------------- */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
        {/* Context bar */}
        <div className="gb-glass rounded-xl p-3 flex items-center gap-2 flex-wrap" data-testid="context-bar">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">Context</span>
          {context.selection?.length ? context.selection.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-purple-950/40 border border-purple-500/40 text-purple-300">
              {s.split(".").pop()}
            </span>
          )) : <span className="text-xs text-slate-500 font-mono">No selection synced</span>}
          {context.open_script && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
              <Code2 size={12} /> {context.open_script}
            </span>
          )}
        </div>

        {/* Prompt input */}
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
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
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
            <Button data-testid="run-prompt-btn" onClick={() => run()} disabled={running || !prompt.trim()}
                    className="bg-gb-violet hover:bg-gb-hover text-white font-semibold rounded-xl">
              {running ? <Loader2 className="animate-spin" size={16} /> : <><Send size={15} className="mr-1.5" /> Generate</>}
            </Button>
          </div>

          {!running && actions.length === 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-slate-600 font-mono mb-1">Try</div>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} data-testid={`suggestion-${i}`} onClick={() => setPrompt(s)}
                        className="w-full text-left text-xs text-slate-400 hover:text-slate-100 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-purple-500/20">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI plan stream */}
        {(planText || actions.length > 0 || running) && (
          <div className="gb-glass rounded-xl p-4 flex flex-col" data-testid="ai-plan-stream">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={15} className="text-gb-violet" />
              <span className="font-semibold text-sm">Action Plan</span>
              {running && <StatusDot color="#8B5CF6" />}
            </div>
            <div ref={planRef} className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
              {hardStop && (
                <div data-testid="hard-stop-banner" className="p-3 rounded-lg bg-red-950/40 border border-red-500/40">
                  <div className="text-xs font-semibold text-red-200 flex items-center gap-1.5">
                    <XCircle size={14} /> Out of credits
                  </div>
                  <p className="text-[11px] text-red-300/80 mt-1">
                    This action needed {hardStop.needed} credits, you have {hardStop.remaining}. No further actions were queued.
                  </p>
                  <Button data-testid="buy-credits-cta" size="sm" onClick={() => navigate("/billing")}
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
              {actions.map((a) => {
                const meta = TOOL_META[a.tool] || { icon: Cpu, label: a.tool, color: "#A78BFA" };
                const st = statusMap[a.command_id] || "queued";
                const Icon = meta.icon;
                return (
                  <div key={a.command_id} data-testid={`action-${a.tool}`}
                       className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0A0A0F] border border-purple-500/15">
                    <Icon size={16} style={{ color: meta.color }} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{meta.label}</span>
                        <span className="text-[10px] font-mono text-gb-glow">{a.cost}c</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {a.args?.name || a.args?.query || a.args?.target || a.args?.asset || a.args?.biome || a.args?.class_name || "—"}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {st === "done" && <CheckCircle2 size={15} className="text-emerald-400" />}
                      {st === "error" && <XCircle size={15} className="text-red-400" />}
                      {st === "in_progress" && <Loader2 size={15} className="text-amber-400 animate-spin" />}
                      {st === "queued" && <CircleDashed size={15} className="text-slate-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- RIGHT: Previews ---------------- */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
        {/* Code preview */}
        <div className="rounded-xl border border-purple-500/30 overflow-hidden bg-[#0A0A0F] flex flex-col" style={{ minHeight: 320 }} data-testid="code-preview">
          <div className="flex items-center gap-2 px-4 h-11 border-b border-purple-500/20 bg-[#0D0D14]">
            <FileCode2 size={15} className="text-emerald-400" />
            <span className="text-sm font-medium">{displayScript ? displayScript.name : "Luau Preview"}</span>
            {scripts.length > 1 && (
              <div className="flex gap-1 ml-2">
                {scripts.map((s) => (
                  <button key={s.id} onClick={() => setActiveScript(s)}
                          className={`text-[11px] px-2 py-0.5 rounded font-mono ${displayScript?.id === s.id ? "bg-gb-active text-white" : "text-slate-500 hover:text-slate-300"}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {displayScript && (
              <Button data-testid="copy-luau-btn" size="sm" variant="ghost"
                      onClick={async () => { const ok = await copyToClipboard(displayScript.source); toast[ok ? "success" : "error"](ok ? "Luau copied" : "Copy failed"); }}
                      className="ml-auto h-7 text-xs text-slate-400 hover:text-white">
                <Copy size={13} className="mr-1" /> Copy
              </Button>
            )}
          </div>
          <div className="flex-1">
            {displayScript ? (
              <LuauEditor value={displayScript.source} />
            ) : (
              <div className="h-full grid place-items-center text-slate-600 text-sm font-mono py-16">
                <div className="text-center">
                  <Code2 size={32} className="mx-auto mb-2 opacity-40" />
                  Generated Luau will appear here
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Toolbox / Terrain preview */}
          <div className="gb-glass rounded-xl p-4" data-testid="asset-preview">
            <div className="flex items-center gap-2 mb-3">
              <Boxes size={15} className="text-amber-400" />
              <span className="font-semibold text-sm">Toolbox & Terrain</span>
            </div>
            {toolboxSearches.length === 0 && terrainOps.length === 0 ? (
              <div className="text-xs text-slate-600 font-mono py-6 text-center">No asset or terrain ops yet</div>
            ) : (
              <div className="space-y-2">
                {terrainOps.length > 0 && <TerrainPreview ops={terrainOps} />}
                {toolboxSearches.map((a) => (
                  <div key={a.command_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gb-elevated border border-purple-500/20">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/30 to-purple-500/20 grid place-items-center">
                      <Search size={16} className="text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{a.args.query}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">verified · likes 98%</div>
                    </div>
                  </div>
                ))}
                {terrainOps.map((a) => {
                  const meta = TOOL_META[a.tool];
                  return (
                    <div key={a.command_id} className="p-2.5 rounded-lg bg-gb-elevated border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-1.5">
                        <meta.icon size={14} style={{ color: meta.color }} />
                        <span className="text-xs font-medium">{meta.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(a.args.materials || [a.args.material]).filter(Boolean).map((m, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 font-mono">{m}</span>
                        ))}
                        {a.args.count && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 font-mono">{a.args.count}×</span>}
                        {a.args.region_size && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/40 text-cyan-300 font-mono">{a.args.region_size.map(Math.round).join("×")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live log stream */}
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
              {logEvents.map((e, i) => (
                <div key={i} className={`flex gap-2 ${e.level === "error" ? "text-red-400" : e.level === "warn" ? "text-amber-400" : "text-slate-400"}`}>
                  <span className="text-slate-700">›</span>
                  <span className="break-all">{e.message}</span>
                </div>
              ))}
            </div>
            {lastError && (
              <Button data-testid="fix-with-ai-btn" onClick={fixWithAI} size="sm"
                      className="mt-3 w-full bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 text-red-200 rounded-xl">
                <Wrench size={14} className="mr-1.5" /> Fix with AI
              </Button>
            )}
          </div>
        </div>

        {/* Studio connection hint */}
        {!studioConnected && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-xs text-amber-300 font-mono flex items-center gap-2" data-testid="studio-offline-hint">
            <StatusDot color="#F59E0B" />
            GUI Blox Connect offline — commands queue until the Studio plugin polls. Add your API key in the plugin widget.
          </div>
        )}
      </div>
    </div>
  );
}
