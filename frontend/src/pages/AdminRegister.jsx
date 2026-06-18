import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { handleOtpVerify, useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { getDashboardPathForUser } from "../lib/routeMap.js";
import { AuthShell } from "../components/layout/index.js";
import { Shield, Users } from "lucide-react";

const ADMIN_FEATURES = [
  {
    icon: Shield,
    title: "System Administration",
    description: "Full control over users, authorities, and application records."
  },
  {
    icon: Users,
    title: "Role Management",
    description: "Register coordinators, HODs, and institution-level reviewers."
  }
];

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
    <AuthShell
      eyebrow="Administrator Access"
      title="Register admin account"
      subtitle="Create the first admin account with password and OTP verification on an allowlisted email."
      features={ADMIN_FEATURES}
    >
      <div className="alert-info mb-6">
        Email must be in the backend <strong>ADMIN_EMAIL_ALLOWLIST</strong>. Role is fixed as Admin.
      </div>

      <form className="space-y-4" onSubmit={otpRequested ? verifyOtp : requestOtp}>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Full Name
          </label>
          <input
            className="input"
            required
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            College Email
          </label>
          <input
            className="input"
            type="email"
            required
            placeholder="admin@sbjit.edu.in"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Password
          </label>
          <input
            className="input"
            type="password"
            required
            minLength={6}
            placeholder="Create a password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Role: <span className="font-semibold text-slate-900">Admin</span>
          <br />
          Department: <span className="font-semibold text-slate-900">Administration</span>
        </div>
        {otpRequested && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              OTP
            </label>
            <input
              className="input"
              inputMode="numeric"
              required
              placeholder="Enter OTP"
              value={form.otp}
              onChange={(e) => setForm((prev) => ({ ...prev, otp: e.target.value }))}
            />
          </div>
        )}
        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}
        <button className="btn btn-primary w-full" type="submit" disabled={sending || verifying}>
          {otpRequested
            ? verifying
              ? "Verifying..."
              : "Verify OTP & Create Account"
            : sending
              ? "Sending OTP..."
              : "Send OTP"}
        </button>
        {otpRequested && (
          <button className="btn btn-ghost w-full" type="button" onClick={requestOtp} disabled={sending || verifying}>
            {sending ? "Resending..." : "Resend OTP"}
          </button>
        )}
      </form>
      <p className="mt-6 text-sm text-slate-500">
        Already have an account?{" "}
        <Link className="font-semibold text-[color:var(--primary-soft)] hover:underline" to="/login">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Student/Faculty?{" "}
        <Link className="font-semibold text-[color:var(--primary-soft)] hover:underline" to="/register">
          Standard registration
        </Link>
      </p>
    </AuthShell>
  );
}
