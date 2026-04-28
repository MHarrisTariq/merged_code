import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm ${isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-900"}`;

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-950 p-4">
      <div className="mb-6 text-lg font-semibold tracking-tight">Swyft Admin</div>
      <nav className="space-y-1">
        <NavLink to="/" end className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/pricing" className={linkClass}>
          Pricing control
        </NavLink>
        <NavLink to="/simulation" className={linkClass}>
          Simulation
        </NavLink>
        <NavLink to="/audit" className={linkClass}>
          Audit log
        </NavLink>
      </nav>
    </aside>
  );
}
