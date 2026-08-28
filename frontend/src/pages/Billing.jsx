import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, CreditCard, Check, Sparkles, Loader2, Star } from "lucide-react";

export default function Billing() {
  const { user } = useAuth();
  const [tab, setTab] = useState("credits");
  const [packs, setPacks] = useState([]);
  const [annual, setAnnual] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    api.get("/payments/catalog").then(({ data }) => { setPacks(data.credit_packs); setAnnual(data.annual_plans); });
    api.get("/billing/ledger").then(({ data }) => setLedger(data)).catch(() => {});
  }, []);

  const buy = async (item_id) => {
    setLoadingId(item_id);
    try {
      const { data } = await api.post("/payments/checkout", { item_id, origin_url: window.location.origin });
      window.location.href = data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Checkout failed");
      setLoadingId(null);
    }
  };

  return (
    <PageShell title="Credits & Plans" subtitle="Buy credit packs or an annual plan. Card data is handled by Stripe (PCI-DSS)." icon={Zap}>
      {/* Balance */}
      <div className="gb-glass rounded-xl p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-500/40 grid place-items-center">
          <Zap size={22} className="text-gb-glow fill-current" />
        </div>
        <div>
          <div className="text-3xl font-extrabold text-white">{user?.credits ?? 0}</div>
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wide">credits · {user?.plan} plan</div>
        </div>
      </div>

      {/* Segmented toggle */}
      <div className="inline-flex p-1 rounded-xl bg-gb-surface border border-purple-500/25 mb-6" data-testid="billing-tabs">
        {[["credits", "Credit Packs"], ["annual", "Annual Plans"]].map(([key, label]) => (
          <button key={key} data-testid={`tab-${key}`} onClick={() => setTab(key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tab === key ? "bg-gb-violet text-white" : "text-slate-400 hover:text-slate-100"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "credits" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="credit-packs">
          {packs.map((p) => (
            <div key={p.id} className={`relative rounded-xl p-5 flex flex-col transition-all hover:-translate-y-0.5 ${
              p.id === "pack_2000" ? "border-2 border-gb-violet bg-gb-surface shadow-xl shadow-purple-950/40" : "gb-glass"}`}>
              {p.id === "pack_2000" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gb-violet text-white whitespace-nowrap">
                  <Star size={10} className="fill-current" /> BEST VALUE
                </span>
              )}
              <div className="text-sm font-mono uppercase tracking-wider text-slate-400">{p.label}</div>
              <div className="mt-2 text-3xl font-extrabold text-white">${p.price_usd}</div>
              <div className="text-gb-glow font-mono text-sm mt-1">{p.credits.toLocaleString()} credits</div>
              <Button data-testid={`buy-${p.id}`} onClick={() => buy(p.id)} disabled={loadingId === p.id}
                      className="w-full mt-auto pt-0 bg-gb-violet hover:bg-gb-hover text-white rounded-xl">
                {loadingId === p.id ? <Loader2 className="animate-spin" size={15} /> : <><CreditCard size={15} className="mr-1.5" /> Buy pack</>}
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === "annual" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-2xl" data-testid="annual-plans">
          {annual.map((p) => (
            <div key={p.id} className={`rounded-xl p-6 ${p.id === "studio_annual" ? "border-2 border-gb-violet bg-gb-surface shadow-xl shadow-purple-950/40" : "gb-glass"}`}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-gb-glow" />
                <span className="text-sm font-semibold text-white">{p.label}</span>
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-500/30">SAVE {p.save_pct}%</span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">${p.price_usd}</span>
                <span className="text-slate-500 text-sm">/ year</span>
              </div>
              <div className="text-xs text-slate-500 mt-1 line-through">${p.monthly_usd * 12}/yr monthly</div>
              <div className="text-gb-glow font-mono text-sm mt-2">{p.credits.toLocaleString()} credits included</div>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                {["Full plan features for 12 months", "Priority bridge polling", "Team sharing + IP allowlists"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> {f}</li>
                ))}
              </ul>
              <Button data-testid={`buy-${p.id}`} onClick={() => buy(p.id)} disabled={loadingId === p.id}
                      className="w-full mt-5 bg-gb-violet hover:bg-gb-hover text-white rounded-xl">
                {loadingId === p.id ? <Loader2 className="animate-spin" size={15} /> : <>Subscribe annually</>}
              </Button>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide font-mono">Usage ledger</h3>
      <div className="space-y-2" data-testid="billing-ledger">
        {ledger.length === 0 && <div className="gb-glass rounded-xl p-6 text-center text-slate-500 text-sm">No credit usage yet.</div>}
        {ledger.map((l, i) => (
          <div key={i} className="gb-glass rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm text-slate-200 truncate">{l.prompt}</div>
              <div className="text-[11px] text-slate-500 font-mono">{new Date(l.created_at).toLocaleString()} · {l.actions} actions</div>
            </div>
            <span className="text-xs font-mono text-red-400 shrink-0">−{l.credits_used}c</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-600 font-mono mt-6">
        Test mode — use card 4242 4242 4242 4242, any future expiry, any CVC.
      </p>
    </PageShell>
  );
}
