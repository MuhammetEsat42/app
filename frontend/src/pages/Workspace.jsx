import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { streamPrompt } from "@/lib/api";
import { api } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { useAuth } from "@/context/AuthContext";
import { useLogStream } from "@/hooks/useLogStream";
import { toast } from "sonner";

import ContextBar from "@/components/workspace/ContextBar";
import PromptComposer from "@/components/workspace/PromptComposer";
import PlanStream from "@/components/workspace/PlanStream";
import CodePreview from "@/components/workspace/CodePreview";
import AssetTerrainPanel from "@/components/workspace/AssetTerrainPanel";
import LogStreamPanel from "@/components/workspace/LogStreamPanel";
import { StatusDot } from "@/components/Brand";

const TERRAIN_TOOLS = ["sculpt_terrain", "paint_terrain_material", "scatter_assets"];

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

  // command status updates from the WS stream
  useEffect(() => {
    setStatusMap((prev) => {
      let next = prev;
      for (const e of events) {
        if (e.type === "command_status" && next[e.command_id] !== e.status) {
          if (next === prev) next = { ...prev };
          next[e.command_id] = e.status;
        }
      }
      return next;
    });
  }, [events]);

  // debounced credit estimate
  useEffect(() => {
    if (!prompt.trim()) { setEstimate(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/workspace/estimate", { prompt });
        setEstimate(data);
      } catch (err) {
        console.error("Estimate failed:", err);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [prompt]);

  const scripts = useMemo(
    () => actions.filter((a) => a.tool === "write_script").map((a) => ({ id: a.command_id, ...a.args })),
    [actions]
  );
  const toolboxSearches = useMemo(() => actions.filter((a) => a.tool === "search_toolbox"), [actions]);
  const terrainOps = useMemo(() => actions.filter((a) => TERRAIN_TOOLS.includes(a.tool)), [actions]);
  const displayScript = activeScript || scripts[scripts.length - 1] || null;

  const logEvents = useMemo(
    () => events.filter((e) => e.type === "log" || e.type === "connected"),
    [events]
  );
  const lastError = useMemo(
    () => [...events].reverse().find((e) => e.type === "log" && e.level === "error" && e.fixable),
    [events]
  );

  const run = useCallback(async (overridePrompt) => {
    const p = typeof overridePrompt === "string" ? overridePrompt : prompt;
    if (!p.trim()) return;
    if ((user?.credits ?? 0) <= 0) { toast.error("No credits remaining. Buy a credit pack."); return; }
    setRunning(true);
    setPlanText("");
    setActions([]);
    setStatusMap({});
    setHardStop(null);
    setActiveScript(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamPrompt({ prompt: p, context }, (ev) => {
        if (ev.type === "token") setPlanText((t) => t + ev.content);
        else if (ev.type === "action") setActions((a) => [...a, ev]);
        else if (ev.type === "hard_stop") { setHardStop({ needed: ev.needed, remaining: ev.remaining }); toast.error("Hard stop: insufficient credits."); }
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
  }, [prompt, user, context, refreshUser]);

  const fixWithAI = useCallback(() => {
    if (!lastError) return;
    const fixPrompt = `A runtime error occurred in Studio:\n"${lastError.message}"\nDiagnose the root cause and write corrected strict-typed Luau to fix it.`;
    setPrompt(fixPrompt);
    run(fixPrompt);
  }, [lastError, run]);

  const copyLuau = useCallback(async (src) => {
    const ok = await copyToClipboard(src);
    toast[ok ? "success" : "error"](ok ? "Luau copied" : "Copy failed");
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-6">
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
        <ContextBar context={context} />
        <PromptComposer
          prompt={prompt} setPrompt={setPrompt} estimate={estimate} running={running}
          canRun={!!prompt.trim()} showSuggestions={!running && actions.length === 0} onRun={run}
        />
        <PlanStream
          planText={planText} actions={actions} statusMap={statusMap} running={running}
          hardStop={hardStop} onBuyCredits={() => navigate("/billing")}
        />
      </div>

      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
        <CodePreview scripts={scripts} displayScript={displayScript} onSelect={setActiveScript} onCopy={copyLuau} />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AssetTerrainPanel toolboxSearches={toolboxSearches} terrainOps={terrainOps} />
          <LogStreamPanel logEvents={logEvents} wsOpen={wsOpen} lastError={lastError} onFix={fixWithAI} />
        </div>
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
