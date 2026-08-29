import { Boxes, Search } from "lucide-react";
import TerrainPreview from "@/components/TerrainPreview";
import { toolMeta } from "@/lib/toolMeta";

export default function AssetTerrainPanel({ toolboxSearches, terrainOps }) {
  const empty = toolboxSearches.length === 0 && terrainOps.length === 0;
  return (
    <div className="gb-glass rounded-xl p-4" data-testid="asset-preview">
      <div className="flex items-center gap-2 mb-3">
        <Boxes size={15} className="text-amber-400" />
        <span className="font-semibold text-sm">Toolbox & Terrain</span>
      </div>
      {empty ? (
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
            const meta = toolMeta(a.tool);
            const Icon = meta.icon;
            return (
              <div key={a.command_id} className="p-2.5 rounded-lg bg-gb-elevated border border-purple-500/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={14} style={{ color: meta.color }} />
                  <span className="text-xs font-medium">{meta.label}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(a.args.materials || [a.args.material]).filter(Boolean).map((m) => (
                    <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 font-mono">{m}</span>
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
  );
}
