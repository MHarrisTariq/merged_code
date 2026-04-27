import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm ${isActive ? "bg-slate-200 text-slate-900" : "text-slate-700 hover:bg-slate-100"}`;

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
      <div className="mb-6 text-lg font-semibold tracking-tight">Swyft Admin</div>
      <nav className="space-y-1">
        <NavLink to="/car" end className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/car/search" className={linkClass}>
          Guest search
        </NavLink>
        <NavLink to="/car/pricing" className={linkClass}>
          Admin pricing
        </NavLink>
        <NavLink to="/car/simulation" className={linkClass}>
          Simulation
        </NavLink>
        <NavLink to="/car/audit" className={linkClass}>
          Audit log
        </NavLink>
      </nav>
    </aside>
  );
}
