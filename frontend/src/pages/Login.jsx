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
      <div className="auth-shell">
        <section className="card p-6 md:p-10">
          <div className="badge">Claim Portal</div>
          <h1 className="mt-6 text-3xl font-semibold font-display sm:text-4xl">Incentive Claim Management</h1>
          <p className="muted mt-3 text-sm">
            Submit, track, and manage reimbursement claims with one secure workflow for students, faculty, and authorities.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Workflow</div>
              <div className="kpi-value">3-Step</div>
              <p className="mt-1 text-xs text-black/60">Coordinator to HOD to Institution</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Notifications</div>
              <div className="kpi-value">Real-time</div>
              <p className="mt-1 text-xs text-black/60">Status updates at every action</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Records</div>
              <div className="kpi-value">Central</div>
              <p className="mt-1 text-xs text-black/60">All claims in one secure dashboard</p>
            </div>
          </div>
          <div className="mt-8 panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="claim-pill">Submit</span>
              <span className="claim-pill">Review</span>
              <span className="claim-pill">Approve</span>
              <span className="claim-pill">Disburse</span>
            </div>
            <p className="muted mt-3 text-sm">All records are encrypted and stored in the campus system.</p>
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
          <div className="section-eyebrow">Claim Access</div>
          <h2 className="section-head">Login to your account</h2>
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
            <button className="btn btn-primary w-full" type="submit">Access Portal</button>
          </form>
          <p className="mt-6 text-sm text-black/60">
            No account? <Link className="text-black underline" to="/register">Register</Link>
          </p>
         
        </section>
      </div>
    </div>
  );
}
