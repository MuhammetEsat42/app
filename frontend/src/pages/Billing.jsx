import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, Check, CreditCard } from "lucide-react";

export default function Billing() {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [ledger, setLedger] = useState([]);

  useEffect(() => {
    api.get("/billing/packages").then(({ data }) => setPackages(data.packages));
    api.get("/billing/ledger").then(({ data }) => setLedger(data)).catch(() => {});
  }, []);

  return (
    <PageShell title="Credits & Plans" subtitle="Buy credit packs. Payments secured by Stripe (PCI-DSS)." icon={Zap}>
      <div className="gb-glass rounded-xl p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-500/40 grid place-items-center">
          <Zap size={22} className="text-gb-glow fill-current" />
        </div>
        <div>
          <div className="text-3xl font-extrabold text-white">{user?.credits ?? 0}</div>
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wide">credits available · {user?.plan} plan</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" data-testid="credit-packages">
        {packages.map((p) => (
          <div key={p.id} className="gb-glass rounded-xl p-5 hover:border-purple-500/40 transition-all hover:-translate-y-0.5">
            <div className="text-sm font-mono uppercase tracking-wider text-slate-400">{p.label}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-white">${p.price_usd}</span>
            </div>
            <div className="text-gb-glow font-mono text-sm mt-1">{p.credits} credits</div>
            <Button data-testid={`buy-${p.id}`} onClick={() => toast.info("Stripe checkout wires up in Phase 5")}
                    className="w-full mt-4 bg-gb-violet hover:bg-gb-hover text-white rounded-xl">
              <CreditCard size={15} className="mr-1.5" /> Buy pack
            </Button>
          </div>
        ))}
      </div>

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
    </PageShell>
  );
}
