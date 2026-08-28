import { useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/PageShell";
import { Users, Crown, Lock } from "lucide-react";

export default function Team() {
  const { user } = useAuth();
  const canTeam = user?.plan !== "free";

  return (
    <PageShell title="Team" subtitle="Invite collaborators with View / Edit roles." icon={Users}>
      {!canTeam ? (
        <div className="gb-glass rounded-xl p-10 text-center" data-testid="team-locked">
          <Lock size={28} className="text-gb-glow mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">Team sharing is a Pro / Studio feature</h3>
          <p className="text-sm text-slate-400 mt-1.5">Upgrade your plan to invite teammates and manage role-based Studio permissions.</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="team-list">
          <div className="gb-glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gb-violet to-gb-hover grid place-items-center font-bold text-white">
                {user?.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium">{user?.email}</div>
                <div className="text-[11px] text-slate-500 font-mono">you</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-300">
              <Crown size={13} /> Owner
            </span>
          </div>
          <div className="gb-glass rounded-xl p-6 text-center text-slate-500 text-sm border-dashed">
            Invite flow ships in Phase 6 — role assignment (View / Edit) per seat.
          </div>
        </div>
      )}
    </PageShell>
  );
}
