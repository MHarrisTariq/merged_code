import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Sidebar } from "./components/Sidebar";
import { AuditLogPage } from "./pages/AuditLog";
import { DashboardPage } from "./pages/Dashboard";
import { LoginPage } from "./pages/Login";
import { PricingControlPage } from "./pages/PricingControl";
import { SimulationPage } from "./pages/Simulation";

function Shell({ children }: { children: React.ReactNode }) {
  const { logout, token } = useAuth();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-800 px-4 py-2 text-sm">
          <span className="text-slate-500">{token ? "Authenticated" : "Guest"}</span>
          {token && (
            <button type="button" className="rounded-md bg-slate-800 px-2 py-1" onClick={logout}>
              Log out
            </button>
          )}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={token ? <Shell><DashboardPage /></Shell> : <Navigate to="/login" replace />}
      />
      <Route
        path="/pricing"
        element={token ? <Shell><PricingControlPage /></Shell> : <Navigate to="/login" replace />}
      />
      <Route
        path="/simulation"
        element={token ? <Shell><SimulationPage /></Shell> : <Navigate to="/login" replace />}
      />
      <Route
        path="/audit"
        element={token ? <Shell><AuditLogPage /></Shell> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
