import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Zap } from "lucide-react";

export default function PaymentResult({ status }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshUser } = useAuth();
  const [state, setState] = useState(status === "cancel" ? "cancelled" : "checking");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (status === "cancel") return;
    const sid = params.get("session_id");
    if (!sid) { setState("error"); return; }
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const { data } = await api.get(`/payments/status/${sid}`);
        if (data.payment_status === "paid") {
          setDetail(data);
          setState("success");
          await refreshUser();
          return;
        }
        if (["expired", "failed"].includes(data.payment_status)) { setState("error"); return; }
      } catch (_) {}
      if (tries < 6) setTimeout(poll, 2000);
      else setState("timeout");
    };
    poll();
  }, [status, params, refreshUser]);

  return (
    <div className="min-h-screen bg-gb-bg flex items-center justify-center p-6">
      <div className="absolute inset-0 gb-grid opacity-40" />
      <div className="relative gb-glass rounded-2xl p-10 max-w-md w-full text-center gb-fade-up">
        <div className="mb-6"><Logo /></div>
        {state === "checking" && (
          <div data-testid="payment-checking">
            <Loader2 size={40} className="text-gb-glow animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Confirming your payment…</h2>
            <p className="text-sm text-slate-400 mt-1">This takes a few seconds.</p>
          </div>
        )}
        {state === "success" && (
          <div data-testid="payment-success">
            <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Payment successful</h2>
            <p className="text-sm text-slate-400 mt-1.5">
              <span className="inline-flex items-center gap-1 text-gb-glow font-semibold">
                <Zap size={14} className="fill-current" /> {detail?.credits?.toLocaleString()} credits
              </span> added to your account.
            </p>
            <Button data-testid="back-to-workspace-btn" onClick={() => navigate("/workspace")}
                    className="w-full mt-6 bg-gb-violet hover:bg-gb-hover text-white rounded-xl">Back to Workspace</Button>
          </div>
        )}
        {(state === "cancelled" || state === "error" || state === "timeout") && (
          <div data-testid="payment-failed">
            <XCircle size={48} className={`mx-auto mb-4 ${state === "cancelled" ? "text-amber-400" : "text-red-400"}`} />
            <h2 className="text-2xl font-bold text-white">
              {state === "cancelled" ? "Payment cancelled" : state === "timeout" ? "Still processing" : "Payment failed"}
            </h2>
            <p className="text-sm text-slate-400 mt-1.5">
              {state === "timeout" ? "Your payment is taking longer than usual. Check your credits shortly." : "No charge was made. You can try again."}
            </p>
            <Button data-testid="back-to-billing-btn" onClick={() => navigate("/billing")} className="w-full mt-6 bg-gb-violet hover:bg-gb-hover text-white rounded-xl">Back to Billing</Button>
          </div>
        )}
      </div>
    </div>
  );
}
