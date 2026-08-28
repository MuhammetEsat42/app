export function PageShell({ title, subtitle, icon: Icon, children, actions }) {
  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="w-11 h-11 rounded-xl bg-purple-950/50 border border-purple-500/30 grid place-items-center shrink-0">
              <Icon size={20} className="text-gb-glow" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
