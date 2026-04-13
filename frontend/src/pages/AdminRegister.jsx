import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { handleOtpVerify, useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { getDashboardPathForUser } from "../lib/routeMap.js";

export default function AdminRegister() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", otp: "" });
  const [otpRequested, setOtpRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const requestOtp = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    setMessage("");
    try {
      const result = await api.requestOtp({
        email: form.email,
        password: form.password,
        purpose: "register",
        name: form.name,
        role: "admin",
        department: "Administration"
      });
      setOtpRequested(true);
      setMessage(result.message || "OTP sent to your email.");
    } catch (err) {
      setError(err.message || "Unable to send OTP.");
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    if (verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const user = await handleOtpVerify({
        email: form.email,
        otp: form.otp,
        purpose: "register"
      });
      setUser(user);
      navigate(getDashboardPathForUser(user));
    } catch (err) {
      setError(err.message || "Unable to verify OTP.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen px-3 py-6 sm:px-4 md:px-8 md:py-10 lg:px-10">
      <div className="auth-shell">
        <section className="card p-6 md:p-10">
          <div className="badge">Claim Portal</div>
          <h1 className="mt-6 text-3xl font-semibold font-display sm:text-4xl">Admin access registration</h1>
          <p className="muted mt-3 text-sm">
            Create the first admin account by setting a password and verifying an allowlisted college email with OTP.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Control</div>
              <div className="kpi-value">Users</div>
              <p className="mt-1 text-xs text-black/60">Manage accounts and authority roles</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Security</div>
              <div className="kpi-value">Password + OTP</div>
              <p className="mt-1 text-xs text-black/60">Only allowlisted admins can self-register</p>
            </div>
          </div>
          <div className="mt-4 panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/40">Admin Rule</div>
            <p className="mt-2 text-sm">The email must be in the backend <span className="font-semibold">ADMIN_EMAIL_ALLOWLIST</span>.</p>
          </div>
        </section>

        <section className="card p-6 md:p-10">
          <div className="section-eyebrow">Admin Claim Access</div>
          <h2 className="section-head">Register admin with Password and OTP</h2>
          <form className="mt-8 space-y-4" onSubmit={otpRequested ? verifyOtp : requestOtp}>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Full name</label>
              <input
                className="input mt-2"
                required
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">College Email</label>
              <input
                className="input mt-2"
                type="email"
                required
                placeholder="admin@sbjit.edu.in"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Password</label>
              <input
                className="input mt-2"
                type="password"
                required
                minLength={6}
                placeholder="Create a password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/70">
              Role: <span className="font-semibold text-black">Admin</span><br />
              Department: <span className="font-semibold text-black">Administration</span>
            </div>
            {otpRequested && (
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-black/40">OTP</label>
                <input
                  className="input mt-2"
                  inputMode="numeric"
                  required
                  placeholder="Enter OTP"
                  value={form.otp}
                  onChange={(e) => setForm((prev) => ({ ...prev, otp: e.target.value }))}
                />
              </div>
            )}
            {message && <div className="text-sm text-emerald-700">{message}</div>}
            {error && <div className="text-sm text-rose-600">{error}</div>}
            <button className="btn btn-primary w-full" type="submit" disabled={sending || verifying}>
              {otpRequested ? (verifying ? "Verifying..." : "Verify OTP & Create Account") : (sending ? "Sending OTP..." : "Send OTP")}
            </button>
            {otpRequested && (
              <button className="btn btn-ghost w-full" type="button" onClick={requestOtp} disabled={sending || verifying}>
                {sending ? "Resending..." : "Resend OTP"}
              </button>
            )}
          </form>
          <p className="mt-6 text-sm text-black/60">
            Already have an account? <Link className="text-black underline" to="/login">Login</Link>
          </p>
          <p className="mt-2 text-sm text-black/60">
            Student/Faculty registration? <Link className="text-black underline" to="/register">Go to Register</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
