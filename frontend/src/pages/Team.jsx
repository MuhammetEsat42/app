import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Crown, Lock, UserPlus, Trash2, Eye, Pencil } from "lucide-react";

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("view");
  const canTeam = user?.plan !== "free";

  const load = async () => {
    try {
      const { data } = await api.get("/team/members");
      setMembers(data.members);
      setCanManage(data.can_manage);
    } catch (_) {}
  };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!email.trim()) return;
    try {
      await api.post("/team/invite", { email, role });
      toast.success(`Invited ${email} as ${role}`);
      setEmail(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Invite failed"); }
  };
  const changeRole = async (id, newRole, memberEmail) => {
    await api.put(`/team/invite/${id}`, { email: memberEmail, role: newRole });
    load();
  };
  const remove = async (id) => { await api.delete(`/team/invite/${id}`); load(); };

  if (!canTeam) {
    return (
      <PageShell title="Team" subtitle="Invite collaborators with View / Edit roles." icon={Users}>
        <div className="gb-glass rounded-xl p-10 text-center" data-testid="team-locked">
          <Lock size={28} className="text-gb-glow mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">Team sharing is a Pro / Studio feature</h3>
          <p className="text-sm text-slate-400 mt-1.5">Upgrade to invite teammates and manage role-based permissions.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Team" subtitle="Invite collaborators with View / Edit roles." icon={Users}>
      {/* Invite form */}
      <div className="gb-glass rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-2" data-testid="invite-form">
        <Input data-testid="invite-email-input" value={email} onChange={(e) => setEmail(e.target.value)}
               placeholder="teammate@studio.com" className="bg-[#0A0A0F] border-purple-500/25 flex-1" />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger data-testid="invite-role-select" className="w-full sm:w-36 bg-[#0A0A0F] border-purple-500/25">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gb-surface border-purple-500/30 text-slate-100">
            <SelectItem value="view">View only</SelectItem>
            <SelectItem value="edit">Can edit</SelectItem>
          </SelectContent>
        </Select>
        <Button data-testid="send-invite-btn" onClick={invite} className="bg-gb-violet hover:bg-gb-hover text-white rounded-xl">
          <UserPlus size={16} className="mr-1.5" /> Invite
        </Button>
      </div>

      {/* Members */}
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
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-300"><Crown size={13} /> Owner</span>
        </div>

        {members.map((m) => (
          <div key={m.id} data-testid={`member-${m.id}`} className="gb-glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gb-elevated border border-purple-500/30 grid place-items-center font-bold text-gb-glow">
                {m.email[0].toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium">{m.email}</div>
                <div className="text-[11px] text-slate-500 font-mono">{m.status}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={m.role} onValueChange={(v) => changeRole(m.id, v, m.email)}>
                <SelectTrigger data-testid={`role-${m.id}`} className="w-32 h-9 bg-[#0A0A0F] border-purple-500/25 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gb-surface border-purple-500/30 text-slate-100">
                  <SelectItem value="view"><span className="flex items-center gap-1.5"><Eye size={12} /> View</span></SelectItem>
                  <SelectItem value="edit"><span className="flex items-center gap-1.5"><Pencil size={12} /> Edit</span></SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" data-testid={`remove-${m.id}`} onClick={() => remove(m.id)}
                      className="text-red-400 hover:text-red-300"><Trash2 size={14} /></Button>
            </div>
          </div>
        ))}
        {members.length === 0 && <div className="gb-glass rounded-xl p-8 text-center text-slate-500 text-sm">No teammates yet — send your first invite above.</div>}
      </div>
    </PageShell>
  );
}
