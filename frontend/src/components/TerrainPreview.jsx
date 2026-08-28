import { useMemo } from "react";

const BIOME_COLORS = {
  forest: ["#14532d", "#166534", "#22c55e"],
  grass: ["#166534", "#22c55e", "#4ade80"],
  desert: ["#78350f", "#b45309", "#fbbf24"],
  snow: ["#94a3b8", "#cbd5e1", "#f8fafc"],
  volcanic: ["#450a0a", "#7f1d1d", "#ef4444"],
  rock: ["#374151", "#4b5563", "#9ca3af"],
  water: ["#0c4a6e", "#0369a1", "#38bdf8"],
};

function pickBiome(ops) {
  for (const o of ops) {
    const b = (o.args.biome || o.args.material || "").toLowerCase();
    for (const key of Object.keys(BIOME_COLORS)) if (b.includes(key)) return key;
  }
  return "grass";
}

// Lightweight CSS-3D voxel bounding-box + biome layers + scatter dots. No heavy deps.
export default function TerrainPreview({ ops }) {
  const biome = useMemo(() => pickBiome(ops), [ops]);
  const colors = BIOME_COLORS[biome];
  const scatter = ops.find((o) => o.tool === "scatter_assets");
  const region = ops.find((o) => o.args.region_size)?.args.region_size || [100, 40, 100];
  const scatterCount = Math.min(scatter?.args.count || 0, 60);

  const dots = useMemo(() =>
    Array.from({ length: scatterCount }).map(() => ({
      x: 8 + Math.random() * 84, y: 8 + Math.random() * 84, s: 3 + Math.random() * 4,
    })), [scatterCount]);

  return (
    <div data-testid="terrain-3d-preview" className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">
          Biome: <span className="text-gb-glow">{biome}</span>
        </span>
        <span className="text-[11px] text-slate-500 font-mono">{region.map(Math.round).join("×")} studs</span>
      </div>

      <div className="relative h-44 rounded-xl overflow-hidden border border-purple-500/20 bg-[#07070c]"
           style={{ perspective: "800px" }}>
        <div className="gb-terrain-spin absolute left-1/2 top-1/2"
             style={{ transformStyle: "preserve-3d", transform: "translate(-50%,-50%) rotateX(58deg) rotateZ(0deg)" }}>
          {/* Voxel biome layers */}
          {colors.map((c, i) => (
            <div key={i} className="absolute rounded-sm"
                 style={{
                   width: 120, height: 120, left: -60, top: -60,
                   background: c, opacity: 0.9 - i * 0.12,
                   transform: `translateZ(${i * 10}px)`,
                   boxShadow: i === colors.length - 1 ? "0 0 30px rgba(139,92,246,0.35)" : "none",
                   border: "1px solid rgba(255,255,255,0.06)",
                 }} />
          ))}
          {/* Scatter dots on top layer */}
          <div className="absolute" style={{ width: 120, height: 120, left: -60, top: -60, transform: `translateZ(${colors.length * 10 + 2}px)` }}>
            {dots.map((d, i) => (
              <span key={i} className="absolute rounded-full"
                    style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s,
                             background: biome === "desert" ? "#a16207" : "#0f4d24",
                             boxShadow: "0 0 3px rgba(0,0,0,0.6)" }} />
            ))}
          </div>
        </div>
        {/* Bounding box label */}
        <div className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-400 bg-black/40 px-1.5 py-0.5 rounded">
          bounding box · {scatterCount > 0 ? `${scatter?.args.count} scatter` : "no scatter"}
        </div>
      </div>
    </div>
  );
}
