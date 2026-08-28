import { Boxes } from "lucide-react";

export function Logo({ size = 22, withText = true }) {
  return (
    <div className="flex items-center gap-2.5 select-none" data-testid="gb-logo">
      <div className="relative grid place-items-center rounded-xl bg-gradient-to-br from-gb-violet to-gb-hover shadow-lg shadow-purple-900/40"
           style={{ width: size + 14, height: size + 14 }}>
        <Boxes size={size} className="text-white" strokeWidth={2.2} />
      </div>
      {withText && (
        <span className="font-extrabold tracking-tight text-white text-lg">
          GUI <span className="text-gb-glow">Blox</span>
        </span>
      )}
    </div>
  );
}

export function StatusDot({ color = "#10B981", ping = true }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {ping && (
        <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ backgroundColor: color }} />
      )}
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
    </span>
  );
}
