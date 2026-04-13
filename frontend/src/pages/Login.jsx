import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { handleLogin, useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { getDashboardPathForUser } from "../lib/routeMap.js";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api.publicNotices().then(setNotices).catch(() => setNotices([]));
  }, []);

  const submitLogin = async (e) => {
    e.preventDefault();
    if (loggingIn) return;
    setLoggingIn(true);
    setError(null);
    try {
      const user = await handleLogin({ email, password });
      setUser(user);
      navigate(getDashboardPathForUser(user));
    } catch (err) {
      setError(err.message || "Unable to login.");
    } finally {
      setLoggingIn(false);
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
          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Workflow</div>
              <div className="kpi-value">3-Step</div>
              <p className="mt-1 text-xs text-black/60">Coordinator to HOD to Institution</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Security</div>
              <div className="kpi-value">Password Login</div>
              <p className="mt-1 text-xs text-black/60">Login with your verified college email and password</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Records</div>
              <div className="kpi-value">Central</div>
              <p className="mt-1 text-xs text-black/60">All claims in one secure portal</p>
            </div>
          </div>
          <div className="mt-8 panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="claim-pill">Register</span>
              <span className="claim-pill">Verify OTP</span>
              <span className="claim-pill">Login</span>
              <span className="claim-pill">Submit</span>
            </div>
            <p className="muted mt-3 text-sm">
              Sign in is allowed only for verified <span className="font-semibold text-black">@sbjit.edu.in</span> accounts.
            </p>
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
              {notices.length === 0 && <div className="muted text-sm">No notices available.</div>}
            </div>
          </div>
        </section>

        <section className="card p-6 md:p-10">
          <div className="section-eyebrow">Claim Access</div>
          <h2 className="section-head">Login with Email and Password</h2>
          <form className="mt-8 space-y-4" onSubmit={submitLogin}>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">College Email</label>
              <input
                className="input mt-2"
                type="email"
                required
                placeholder="you@sbjit.edu.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Password</label>
              <input
                className="input mt-2"
                type="password"
                required
                minLength={6}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-sm text-rose-600">{error}</div>}
            <button className="btn btn-primary w-full" type="submit" disabled={loggingIn}>
              {loggingIn ? "Signing In..." : "Login"}
            </button>
          </form>
          <p className="mt-4 text-sm text-black/60">
            Forgot password? <Link className="text-black underline" to="/forgot-password">Reset with OTP</Link>
          </p>
          <p className="mt-6 text-sm text-black/60">
            No account? <Link className="text-black underline" to="/register">Register</Link>
          </p>
          <p className="mt-2 text-sm text-black/60">
            Registration requires password setup plus email OTP verification.
          </p>
        </section>
      </div>
    </div>
  );
}
