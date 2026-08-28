import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Fingerprint, Mail, ArrowRight, Loader2 } from "lucide-react";

export default function Auth({ mode }) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const { login, setTokens } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fp, setFp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("form"); // form | verify
  const [code, setCode] = useState("");
  const [mockCode, setMockCode] = useState("");
  const [captchaOk, setCaptchaOk] = useState(false);

  useEffect(() => {
    FingerprintJS.load().then((agent) => agent.get()).then((r) => setFp(r.visitorId)).catch(() => {});
  }, []);

  const doLogin = async () => {
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u) { toast.success("Welcome back, engineer."); navigate("/workspace"); }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  const doRegister = async () => {
    if (!captchaOk) { toast.error("Complete the human check first"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        email, password, fingerprint: fp, turnstile_token: "mock-turnstile-token",
      });
      setMockCode(data.verification_code_mock || "");
      setStep("verify");
      toast.success("Account created. Verify your email to unlock 5 credits.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  };

  const doVerify = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-email", { email, code });
      await setTokens(data);
      toast.success("Email verified — 5 free credits activated.");
      navigate("/workspace");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Verification failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gb-bg flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden border-r border-purple-500/15">
        <div className="absolute inset-0 gb-grid opacity-60" />
        <div className="absolute inset-0 gb-radial-glow" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <Logo />
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.05]">
              Prompt on the web.<br />
              <span className="text-gb-glow">Build in Studio.</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed">
              GUI Blox is a Cloud-to-Studio AI copilot. Write intent from the dashboard —
              <span className="text-slate-200 font-mono text-sm"> GUI Blox Connect</span> executes
              instances, Luau, terrain and scatter live in Roblox Studio.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {["Argon2id keys", "JWT rotation", "Redis rate-limit", "Anti-fraud"].map((t) => (
                <span key={t} className="px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-300">{t}</span>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-mono">V2.2 · Neon Purple · Phase 1 + AI Workspace</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm gb-fade-up">
          <div className="lg:hidden mb-8"><Logo /></div>

          {step === "form" && (
            <>
              <h2 className="text-2xl font-bold text-white">{isRegister ? "Create your account" : "Sign in"}</h2>
              <p className="text-sm text-slate-400 mt-1 mb-6">
                {isRegister ? "5 free credits after email verification." : "Access your GUI Blox workspace."}
              </p>

              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300 text-xs uppercase tracking-wide">Email</Label>
                  <Input data-testid="auth-email-input" type="email" value={email}
                         onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com"
                         className="mt-1.5 bg-gb-surface border-purple-500/25 focus-visible:ring-gb-violet" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs uppercase tracking-wide">Password</Label>
                  <Input data-testid="auth-password-input" type="password" value={password}
                         onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                         className="mt-1.5 bg-gb-surface border-purple-500/25 focus-visible:ring-gb-violet" />
                </div>

                {isRegister && (
                  <button
                    type="button"
                    data-testid="captcha-mock-btn"
                    onClick={() => setCaptchaOk((v) => !v)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      captchaOk ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                                : "border-purple-500/25 bg-gb-surface text-slate-400 hover:border-purple-500/40"
                    }`}
                  >
                    <ShieldCheck size={16} />
                    {captchaOk ? "Human verified (Turnstile mock)" : "I'm human — click to verify"}
                  </button>
                )}

                {isRegister && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <Fingerprint size={13} />
                    {fp ? `Device fingerprint: ${fp.slice(0, 12)}…` : "Computing fingerprint…"}
                  </div>
                )}

                <Button
                  data-testid={isRegister ? "register-submit-btn" : "login-submit-btn"}
                  onClick={isRegister ? doRegister : doLogin}
                  disabled={loading}
                  className="w-full bg-gb-violet hover:bg-gb-hover text-white font-semibold h-11 rounded-xl relative overflow-hidden"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : (
                    <>{isRegister ? "Create account" : "Sign in"} <ArrowRight size={16} className="ml-1" /></>
                  )}
                </Button>
              </div>

              <p className="text-sm text-slate-400 mt-6 text-center">
                {isRegister ? "Already registered? " : "No account yet? "}
                <Link to={isRegister ? "/login" : "/register"}
                      data-testid="auth-toggle-link"
                      className="text-gb-glow hover:underline font-medium">
                  {isRegister ? "Sign in" : "Create one"}
                </Link>
              </p>

              {!isRegister && (
                <div className="mt-6 p-3 rounded-xl bg-gb-surface border border-purple-500/20 text-xs text-slate-400 font-mono">
                  Demo: <span className="text-gb-glow">test@guiblox.com</span> / <span className="text-gb-glow">Test1234!</span>
                </div>
              )}
            </>
          )}

          {step === "verify" && (
            <div className="gb-fade-up">
              <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-500/40 grid place-items-center mb-4">
                <Mail className="text-gb-glow" size={22} />
              </div>
              <h2 className="text-2xl font-bold text-white">Verify your email</h2>
              <p className="text-sm text-slate-400 mt-1 mb-4">
                Enter the 6-digit code sent to <span className="text-slate-200">{email}</span>.
              </p>
              {mockCode && (
                <div className="mb-4 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 font-mono">
                  MOCK EMAIL — your code is <span className="font-bold text-amber-200 text-sm">{mockCode}</span>
                </div>
              )}
              <Input data-testid="verify-code-input" value={code}
                     onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6}
                     className="bg-gb-surface border-purple-500/25 text-center text-2xl tracking-[0.5em] font-mono h-14" />
              <Button data-testid="verify-submit-btn" onClick={doVerify} disabled={loading}
                      className="w-full mt-4 bg-gb-violet hover:bg-gb-hover text-white font-semibold h-11 rounded-xl">
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Verify & activate credits"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
