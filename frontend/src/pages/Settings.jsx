import { useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sliders, Download, ShieldOff } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  const downloadPlugin = () => {
    toast.success("GUI Blox Connect (.lua) available in /app/plugin — upload to Roblox Creator Store");
  };

  return (
    <PageShell title="Settings" subtitle="Account, plugin, and privacy controls." icon={Sliders}>
      <div className="space-y-4 max-w-2xl">
        <div className="gb-glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Account</h3>
          <div className="space-y-2 text-sm">
            <Row label="Email" value={user?.email} />
            <Row label="Plan" value={user?.plan} />
            <Row label="Email verified" value={user?.email_verified ? "Yes" : "No"} />
            <Row label="Credits" value={String(user?.credits ?? 0)} />
          </div>
        </div>

        <div className="gb-glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">GUI Blox Connect</h3>
          <p className="text-xs text-slate-400 mb-3">Install the bridge plugin in Roblox Studio, paste an API key, and enable HTTP requests.</p>
          <Button data-testid="download-plugin-btn" onClick={downloadPlugin} className="bg-gb-violet hover:bg-gb-hover text-white rounded-xl">
            <Download size={15} className="mr-1.5" /> Get plugin
          </Button>
        </div>

        <div className="gb-glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1"><ShieldOff size={16} className="text-emerald-400" /><h3 className="text-sm font-semibold text-white">Zero Data Retention</h3></div>
          <p className="text-xs text-slate-400">Your prompts and generated code are never used to train external AI models. Storage is user-scoped and auto-purged per your plan's retention window.</p>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-purple-500/10 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono">{value}</span>
    </div>
  );
}
