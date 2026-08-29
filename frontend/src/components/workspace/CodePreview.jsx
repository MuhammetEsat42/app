import { FileCode2, Copy, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import LuauEditor from "@/components/LuauEditor";

export default function CodePreview({ scripts, displayScript, onSelect, onCopy }) {
  return (
    <div className="rounded-xl border border-purple-500/30 overflow-hidden bg-[#0A0A0F] flex flex-col" style={{ minHeight: 320 }} data-testid="code-preview">
      <div className="flex items-center gap-2 px-4 h-11 border-b border-purple-500/20 bg-[#0D0D14]">
        <FileCode2 size={15} className="text-emerald-400" />
        <span className="text-sm font-medium">{displayScript ? displayScript.name : "Luau Preview"}</span>
        {scripts.length > 1 && (
          <div className="flex gap-1 ml-2">
            {scripts.map((s) => (
              <button key={s.id} onClick={() => onSelect(s)}
                      className={`text-[11px] px-2 py-0.5 rounded font-mono ${displayScript?.id === s.id ? "bg-gb-active text-white" : "text-slate-500 hover:text-slate-300"}`}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        {displayScript && (
          <Button data-testid="copy-luau-btn" size="sm" variant="ghost" onClick={() => onCopy(displayScript.source)}
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
  );
}
