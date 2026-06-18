import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { handleOtpVerify, useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { getDashboardPathForUser } from "../lib/routeMap.js";
import { AuthShell } from "../components/layout/index.js";

const DEPARTMENTS = [
  "First Year",
  "CSE",
  "AIML",
  "AIDS",
  "ETC",
  "IT",
  "EE",
  "ME",
  "CA (Computer Applications)",
  "BA (Business Administration)"
];

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    department: "",
    otp: ""
  });
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
        role: form.role,
        department: form.department
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
      wide
      eyebrow="New Account"
      title="Create your portal account"
      subtitle="Register with your college email, set a password, and verify via OTP."
    >
      <form className="space-y-4" onSubmit={otpRequested ? verifyOtp : requestOtp}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
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
              placeholder="you@sbjit.edu.in"
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
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Role
            </label>
            <select
              className="input"
              required
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Department
            </label>
            <select
              className="input"
              required
              value={form.department}
              onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
            >
              <option value="" disabled>
                Select department
              </option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>
        </div>

        {otpRequested && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              OTP Verification
            </label>
            <input
              className="input"
              inputMode="numeric"
              required
              placeholder="Enter OTP from email"
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
    </AuthShell>
  );
}
