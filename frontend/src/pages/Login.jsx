import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { handleLogin, useAuth } from "../lib/auth.jsx";
import { getDashboardPathForUser } from "../lib/routeMap.js";
import { api } from "../lib/api.js";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api.publicNotices().then(setNotices).catch(() => setNotices([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }
    try {
      const user = await handleLogin(form);
      setUser(user);
      navigate(getDashboardPathForUser(user));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen px-3 py-6 sm:px-4 md:px-8 md:py-10 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-6 md:p-10">
          <div className="badge">Incentive Portal</div>
          <h1 className="mt-6 text-3xl font-semibold font-display sm:text-4xl">Welcome back.</h1>
          <p className="muted mt-3 text-sm">
            Track your submissions, review status updates, and manage incentive claims in one place.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Fast Review</div>
              <p className="mt-2 text-sm">Applications routed to the right reviewer automatically.</p>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Live Updates</div>
              <p className="mt-2 text-sm">Get notifications when status changes.</p>
            </div>
          </div>
          <div className="mt-8 rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="text-sm font-semibold">Secure access</div>
            <p className="muted mt-1 text-sm">All data is encrypted and stored in the campus system.</p>
          </div>
          <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="text-sm font-semibold">Notices</div>
            <div className="mt-2 space-y-2 text-sm">
              {notices.slice(0, 6).map((notice) => {
                const href = notice.file_path?.startsWith("http")
                  ? notice.file_path
                  : `${API_URL}${notice.file_path || ""}`;
                return (
                  <div key={notice.id} className="rounded-xl border border-black/10 bg-white/60 p-3">
                    <div className="font-medium">{notice.title}</div>
                    <div className="muted mt-1 text-xs">{new Date(notice.created_at).toLocaleDateString()}</div>
                    <a className="mt-2 inline-block text-black underline" href={href} target="_blank" rel="noreferrer">
                      View Notice
                    </a>
                  </div>
                );
              })}
              {notices.length === 0 && (
                <div className="muted text-sm">No notices available.</div>
              )}
            </div>
          </div>
        </section>

        <section className="card p-6 md:p-10">
          <div className="text-xs uppercase tracking-[0.2em] text-black/40">Sign In</div>
          <h2 className="mt-4 text-2xl font-semibold font-display sm:text-3xl">Login to your account</h2>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Email</label>
              <input className="input mt-2" type="email" required placeholder="you@college.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Password</label>
              <input className="input mt-2" type="password" required placeholder="********" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            {error && <div className="text-rose-600 text-sm">{error}</div>}
            <button className="btn btn-primary w-full" type="submit">Login</button>
          </form>
          <p className="mt-6 text-sm text-black/60">
            No account? <Link className="text-black underline" to="/register">Register</Link>
          </p>
         
        </section>
      </div>
    </div>
  );
}
