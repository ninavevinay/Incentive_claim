import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { AuthShell } from "../components/layout/index.js";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    otp: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [otpRequested, setOtpRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const requestResetOtp = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    setMessage("");
    try {
      const result = await api.forgotPassword({ email: form.email });
      setOtpRequested(true);
      setMessage(result.message || "Password reset OTP sent to your email.");
    } catch (err) {
      setError(err.message || "Unable to send password reset OTP.");
    } finally {
      setSending(false);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    if (resetting) return;
    setError(null);
    setMessage("");

    if (form.newPassword !== form.confirmPassword) {
      setError("Confirm password does not match.");
      return;
    }

    setResetting(true);
    try {
      const result = await api.resetPassword({
        email: form.email,
        otp: form.otp,
        new_password: form.newPassword
      });
      const successMessage = result.message || "Password reset successful. Please login with your new password.";
      navigate("/login", {
        replace: true,
        state: { successMessage }
      });
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account Recovery"
      title={otpRequested ? "Set your new password" : "Reset your password"}
      subtitle="Verify your college email with OTP and choose a new secure password."
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 1</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">Request OTP</div>
          <p className="mt-1 text-xs text-slate-500">Sent to your registered email</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 2</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">Set Password</div>
          <p className="mt-1 text-xs text-slate-500">Enter OTP and new credentials</p>
        </div>
      </div>

      <div className="alert-info mb-6">
        Only verified <strong>@sbjit.edu.in</strong> users can reset passwords.
      </div>

      <form className="space-y-4" onSubmit={otpRequested ? submitNewPassword : requestResetOtp}>
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

        {otpRequested && (
          <>
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
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                New Password
              </label>
              <input
                className="input"
                type="password"
                required
                minLength={6}
                placeholder="Enter new password"
                value={form.newPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Confirm New Password
              </label>
              <input
                className="input"
                type="password"
                required
                minLength={6}
                placeholder="Confirm new password"
                value={form.confirmPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
          </>
        )}

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        <button className="btn btn-primary w-full" type="submit" disabled={sending || resetting}>
          {otpRequested
            ? resetting
              ? "Resetting..."
              : "Verify OTP & Reset Password"
            : sending
              ? "Sending OTP..."
              : "Send Reset OTP"}
        </button>

        {otpRequested && (
          <button
            className="btn btn-ghost w-full"
            type="button"
            onClick={requestResetOtp}
            disabled={sending || resetting}
          >
            {sending ? "Resending..." : "Resend OTP"}
          </button>
        )}
      </form>

      <p className="mt-6 text-sm text-slate-500">
        Remember your password?{" "}
        <Link className="font-semibold text-[color:var(--primary-soft)] hover:underline" to="/login">
          Back to Sign In
        </Link>
      </p>
      <p className="mt-2 text-sm text-slate-500">
        New user?{" "}
        <Link className="font-semibold text-[color:var(--primary-soft)] hover:underline" to="/register">
          Create account
        </Link>
      </p>
    </AuthShell>
  );
}
