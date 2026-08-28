import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FolderGit2, Plus, Trash2 } from "lucide-react";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");

  const load = async () => { const { data } = await api.get("/projects"); setProjects(data); };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    await api.post("/projects", { name, data: {} });
    setName(""); toast.success("Project saved"); load();
  };
  const del = async (id) => { await api.delete(`/projects/${id}`); load(); };

  return (
    <PageShell title="Projects" subtitle="Save and reload workspace states." icon={FolderGit2}>
      <div className="flex gap-2 mb-6 max-w-md">
        <Input data-testid="project-name-input" value={name} onChange={(e) => setName(e.target.value)}
               placeholder="New project name…" className="bg-gb-surface border-purple-500/25" />
        <Button data-testid="create-project-btn" onClick={create} className="bg-gb-violet hover:bg-gb-hover rounded-xl">
          <Plus size={16} className="mr-1" /> Save
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="projects-grid">
        {projects.length === 0 && <div className="col-span-full gb-glass rounded-xl p-10 text-center text-slate-500 text-sm">No projects yet.</div>}
        {projects.map((p) => (
          <div key={p.id} className="gb-glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950/50 border border-purple-500/30 grid place-items-center">
                <FolderGit2 size={17} className="text-gb-glow" />
              </div>
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-[11px] text-slate-500 font-mono">{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => del(p.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
