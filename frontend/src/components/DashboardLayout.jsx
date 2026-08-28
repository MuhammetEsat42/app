import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Terminal, FolderGit2, History, Zap, Users, KeyRound, ShieldCheck, Sliders, LogOut, Menu,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Logo, StatusDot } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { name: "Workspace", path: "/workspace", icon: Terminal, testid: "nav-workspace-link" },
  { name: "Projects", path: "/projects", icon: FolderGit2, testid: "nav-projects-link" },
  { name: "Prompt History", path: "/history", icon: History, testid: "nav-history-link" },
  { name: "Credits & Plans", path: "/billing", icon: Zap, testid: "nav-billing-link" },
  { name: "Team", path: "/team", icon: Users, testid: "nav-team-link" },
  { name: "API & Bridge Keys", path: "/keys", icon: KeyRound, testid: "nav-apikeys-link" },
  { name: "Security & Audit", path: "/security", icon: ShieldCheck, testid: "nav-security-link" },
  { name: "Settings", path: "/settings", icon: Sliders, testid: "nav-settings-link" },
];

function NavBody({ user, logout, onNavigate }) {
  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink
            key={n.path}
            to={n.path}
            data-testid={n.testid}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                isActive
                  ? "bg-gb-active text-white border border-purple-500/40 shadow-lg shadow-purple-950/30"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <n.icon size={17} />
            <span className="font-medium">{n.name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-purple-500/15">
        <div className="rounded-xl bg-gb-surface border border-purple-500/20 p-3 mb-2">
          <div className="text-xs text-slate-400">Signed in</div>
          <div className="text-sm font-medium truncate">{user?.email}</div>
          <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-gb-glow font-mono uppercase tracking-wide">
            {user?.plan} plan
          </div>
        </div>
        <Button variant="ghost" onClick={logout} data-testid="logout-btn"
                className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/5">
          <LogOut size={16} className="mr-2" /> Log out
        </Button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [studio, setStudio] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const { data } = await api.get("/workspace/bridge-state");
        if (alive) setStudio(data.connected);
      } catch (_) {}
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="min-h-screen bg-gb-bg text-slate-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-purple-500/15 bg-[#0B0B11] fixed h-screen z-30">
        <div className="h-16 flex items-center px-5 border-b border-purple-500/15">
          <button onClick={() => navigate("/workspace")} data-testid="sidebar-logo-btn">
            <Logo />
          </button>
        </div>
        <NavBody user={user} logout={logout} />
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 border-b border-purple-500/15 bg-gb-bg/90 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="mobile-nav-trigger"
                        className="text-slate-300 hover:text-white hover:bg-white/5">
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-[#0B0B11] border-purple-500/20 p-0 flex flex-col">
                <div className="h-16 flex items-center px-5 border-b border-purple-500/15">
                  <Logo />
                </div>
                <NavBody user={user} logout={logout} onNavigate={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>
            <Logo withText={false} />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div data-testid="studio-status-pill"
                 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gb-elevated border border-purple-500/30">
              <StatusDot color={studio ? "#10B981" : "#EF4444"} ping={studio} />
              <span className={studio ? "text-emerald-300" : "text-red-300"}>
                Studio {studio ? "Connected" : "Offline"}
              </span>
            </div>
            <div data-testid="credit-balance"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-950/50 border border-purple-500/40 text-gb-glow">
              <Zap size={13} className="fill-current" />
              {user?.credits ?? 0} credits
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
