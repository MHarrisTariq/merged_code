import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Sidebar } from "./components/Sidebar";
import { AuditLogPage } from "./pages/AuditLog";
import { DashboardPage } from "./pages/Dashboard";
import { ListingCalendarPage } from "./pages/ListingCalendarPage";
import { ListingDetailPage } from "./pages/ListingDetailPage";
import { ListingInsightsPage } from "./pages/ListingInsightsPage";
import { ListingSettingsPage } from "./pages/ListingSettingsPage";
import { LoginPage } from "./pages/Login";
import { PricingControlPage } from "./pages/PricingControl";
import { SearchPage } from "./pages/SearchPage";
import { SimulationPage } from "./pages/Simulation";

function Shell({ children }: { children: React.ReactNode }) {
  const { logout, token } = useAuth();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2 text-sm">
          <span className="text-slate-500">{token ? "Authenticated" : "Guest"}</span>
          {token && (
            <button type="button" className="rounded-md bg-slate-200 text-slate-900 px-2 py-1" onClick={logout}>
              Log out
            </button>
          )}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

/**
 * CarApp is mounted under parent route `/car/*` from root App.
 * Keep child paths relative so /car, /car/pricing, etc. resolve correctly.
 */
export default function App() {
  useAuth();
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="search" element={<Shell><SearchPage /></Shell>} />
      <Route path="listing/:id/calendar" element={<Shell><ListingCalendarPage /></Shell>} />
      <Route path="listing/:id/settings" element={<Shell><ListingSettingsPage /></Shell>} />
      <Route path="listing/:id/insights" element={<Shell><ListingInsightsPage /></Shell>} />
      <Route path="listing/:id" element={<Shell><ListingDetailPage /></Shell>} />
      <Route path="pricing" element={<Shell><PricingControlPage /></Shell>} />
      <Route path="simulation" element={<Shell><SimulationPage /></Shell>} />
      <Route path="audit" element={<Shell><AuditLogPage /></Shell>} />
      <Route index element={<Shell><DashboardPage /></Shell>} />
      <Route path="*" element={<Navigate to="/car" replace />} />
    </Routes>
  );
}
