import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Workspace from "@/pages/Workspace";
import ApiKeys from "@/pages/ApiKeys";
import Projects from "@/pages/Projects";
import History from "@/pages/History";
import Billing from "@/pages/Billing";
import Team from "@/pages/Team";
import Security from "@/pages/Security";
import Settings from "@/pages/Settings";
import PaymentResult from "@/pages/PaymentResult";
import NotFound from "@/pages/NotFound";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gb-bg text-gb-glow font-mono text-sm">Booting GUI Blox…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardLayout><Outlet /></DashboardLayout>;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/payment/success" element={<PaymentResult status="success" />} />
            <Route path="/payment/cancel" element={<PaymentResult status="cancel" />} />
            <Route element={<Protected />}>
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/history" element={<History />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/team" element={<Team />} />
              <Route path="/api-keys" element={<ApiKeys />} />
              <Route path="/keys" element={<ApiKeys />} />
              <Route path="/security" element={<Security />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" theme="dark" />
      </AuthProvider>
    </div>
  );
}

export default App;
