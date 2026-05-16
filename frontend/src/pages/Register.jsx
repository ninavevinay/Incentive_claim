import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { handleOtpVerify, useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { getDashboardPathForUser } from "../lib/routeMap.js";

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
    <div className="auth-page">
      <div className="auth-shell">
        <section className="card p-6 md:p-10">
          <div className="badge">Claim Portal</div>
          <h1 className="mt-6 text-3xl font-semibold font-display sm:text-4xl">Create your incentive account</h1>
          <p className="muted mt-3 text-sm">
            Register with your college email, set a password, and verify ownership with a one-time password.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Step 1</div>
              <div className="kpi-value">Profile</div>
              <p className="mt-1 text-xs text-black/60">Enter your name, role, and department</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Step 2</div>
              <div className="kpi-value">Password</div>
              <p className="mt-1 text-xs text-black/60">Choose the password you will use for future login</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Step 3</div>
              <div className="kpi-value">OTP</div>
              <p className="mt-1 text-xs text-black/60">Verify the code sent to your college email</p>
            </div>
          </div>
          <div className="mt-6 panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/40">Registration Rule</div>
            <p className="mt-2 text-sm">Only <span className="font-semibold">@sbjit.edu.in</span> email addresses can create portal access.</p>
          </div>
        </section>

        <section className="card p-6 md:p-10">
          <div className="section-eyebrow">Claim Registration</div>
          <h2 className="section-head">Register with Password and OTP</h2>
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
                placeholder="you@sbjit.edu.in"
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
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Role</label>
              <select
                className="input mt-2"
                required
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Department</label>
              <select
                className="input mt-2"
                required
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
              >
                <option value="" disabled>Select department</option>
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
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
        </section>
      </div>
    </div>
  );
}
