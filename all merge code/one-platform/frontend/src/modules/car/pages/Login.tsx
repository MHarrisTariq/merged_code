import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await login(password);
      nav("/car");
    } catch {
      setErr("Invalid password");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-slate-400">JWT is kept in memory only for this session.</p>
        <input
          type="password"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Admin UI password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button type="submit" className="w-full rounded-md bg-sky-600 py-2 text-sm font-medium hover:bg-sky-500">
          Continue
        </button>
      </form>
    </div>
  );
}
