import { Link } from "react-router-dom";
import { Logo, StatusDot } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  Terminal, Cpu, Mountain, ShieldCheck, Zap, ArrowRight, Boxes, Code2, Radio, Check,
} from "lucide-react";

const FEATURES = [
  { icon: Terminal, title: "Cloud-to-Studio Bridge", desc: "Prompt from the web. GUI Blox Connect polls every 2s and executes in Studio — instances, Luau, terrain." },
  { icon: Cpu, title: "Senior Engineer AI", desc: "Claude Sonnet 4.6 tool-calling produces strict-typed Luau, task.wait() loops, ModuleScripts. Zero filler." },
  { icon: Mountain, title: "Procedural Terrain", desc: "Perlin heightmaps, biome painting, Poisson-disk scatter — full map generation, terrain-conforming." },
  { icon: ShieldCheck, title: "Full Security Stack", desc: "Argon2id keys, JWT rotation, Redis rate-limits, multi-layer anti-fraud, per-key IP allowlists." },
];

const PLANS = [
  { name: "Free", price: "$0", credits: "5 credits (one-time)", features: ["1 Studio bridge", "Standard Luau gen", "30-day prompt history", "Public Toolbox search"], cta: "Get Started", to: "/register" },
  { name: "Professional", price: "$15", credits: "150 credits / pack", badge: "Popular", features: ["Team sharing", "IP allowlisting", "Terrain & map gen", "One-click AI auto-fix", "Sub-second bridge"], cta: "Choose Pro", to: "/register" },
  { name: "Studio", price: "$20", credits: "200 credits / pack", features: ["Unlimited history", "Role-based team seats", "Security audit + sessions", "Custom style prompts"], cta: "Launch Studio", to: "/register" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gb-bg text-slate-100 overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-purple-500/15 bg-gb-bg/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link to="/login"><Button variant="ghost" data-testid="nav-login-btn" className="text-slate-300 hover:text-white">Sign in</Button></Link>
            <Link to="/register"><Button data-testid="nav-register-btn" className="bg-gb-violet hover:bg-gb-hover text-white rounded-xl">Start free</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 gb-grid opacity-50" />
        <div className="absolute inset-0 gb-radial-glow" />
        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/40 border border-purple-500/30 text-xs font-mono text-purple-300 mb-6 gb-fade-up">
            <StatusDot color="#8B5CF6" /> V2.2 · Neon Purple · Roblox Creator Store
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.05] gb-fade-up">
            Prompt on the web.<br /><span className="text-gb-glow">Build in Roblox Studio.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto gb-fade-up">
            GUI Blox is an AI copilot that turns natural language into live Studio actions — instances, strict-typed Luau,
            Toolbox imports, and full procedural terrain — executed by the GUI Blox Connect bridge plugin.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 gb-fade-up">
            <Link to="/register"><Button data-testid="hero-cta-btn" size="lg" className="bg-gb-violet hover:bg-gb-hover text-white rounded-xl h-12 px-7 font-semibold">
              Start building free <ArrowRight size={18} className="ml-1.5" />
            </Button></Link>
            <Link to="/login"><Button size="lg" variant="outline" className="rounded-xl h-12 px-7 border-purple-500/40 bg-transparent hover:bg-white/5 text-slate-200">Live demo</Button></Link>
          </div>

          {/* Bridge diagram */}
          <div className="mt-16 max-w-3xl mx-auto grid grid-cols-3 gap-3 gb-fade-up">
            {[
              { icon: Code2, label: "Web Dashboard", sub: "prompt" },
              { icon: Cpu, label: "FastAPI + AI", sub: "queue" },
              { icon: Boxes, label: "GUI Blox Connect", sub: "executes" },
            ].map((n, i) => (
              <div key={n.label} className="gb-glass rounded-xl p-5 relative">
                <n.icon size={22} className="text-gb-glow mx-auto mb-2" />
                <div className="text-sm font-semibold">{n.label}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{n.sub}</div>
                {i < 2 && <ArrowRight size={16} className="hidden sm:block absolute -right-2.5 top-1/2 -translate-y-1/2 text-purple-500/60 z-10" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="gb-glass rounded-xl p-6 hover:border-purple-500/40 transition-all hover:-translate-y-0.5">
              <div className="w-11 h-11 rounded-xl bg-purple-950/50 border border-purple-500/30 grid place-items-center mb-4">
                <f.icon size={20} className="text-gb-glow" />
              </div>
              <h3 className="text-lg font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Credits, your way</h2>
          <p className="text-slate-400 mt-2">Start free. Buy packs as you scale. No card data touches us — Stripe handles PCI.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div key={p.name} data-testid={`landing-plan-${p.name.toLowerCase()}`}
                 className={`rounded-xl p-6 relative ${p.badge ? "border-2 border-gb-violet bg-gb-surface shadow-xl shadow-purple-950/40" : "gb-glass"}`}>
              {p.badge && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-3 py-1 rounded-full bg-gb-violet text-white">{p.badge}</span>}
              <div className="text-sm font-mono uppercase tracking-wider text-slate-400">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">{p.price}</span>
                <span className="text-slate-500 text-sm">/ pack</span>
              </div>
              <div className="text-xs text-gb-glow font-mono mt-1">{p.credits}</div>
              <ul className="mt-5 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check size={15} className="text-emerald-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to={p.to}><Button className={`w-full mt-6 rounded-xl ${p.badge ? "bg-gb-violet hover:bg-gb-hover text-white" : "bg-white/5 hover:bg-white/10 text-slate-100 border border-purple-500/30"}`}>{p.cta}</Button></Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-purple-500/15 mt-10">
        <div className="max-w-6xl mx-auto px-5 py-8 flex items-center justify-between flex-wrap gap-4">
          <Logo />
          <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <Radio size={13} /> Zero Data Retention · never trains external AI
          </div>
        </div>
      </footer>
    </div>
  );
}
