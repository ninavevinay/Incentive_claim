import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function ForgotPassword() {
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
      setMessage(result.message || "Password reset successful. Please login with your new password.");
      setForm((prev) => ({
        ...prev,
        otp: "",
        newPassword: "",
        confirmPassword: ""
      }));
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen px-3 py-6 sm:px-4 md:px-8 md:py-10 lg:px-10">
      <div className="auth-shell">
        <section className="card p-6 md:p-10">
          <div className="badge">Claim Portal</div>
          <h1 className="mt-6 text-3xl font-semibold font-display sm:text-4xl">Forgot your password?</h1>
          <p className="muted mt-3 text-sm">
            Verify your college email with OTP and set a new password for your portal account.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Step 1</div>
              <div className="kpi-value">Send OTP</div>
              <p className="mt-1 text-xs text-black/60">Get reset OTP on your registered email address</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Step 2</div>
              <div className="kpi-value">Set Password</div>
              <p className="mt-1 text-xs text-black/60">Enter OTP and choose a new login password</p>
            </div>
          </div>
          <div className="mt-6 panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/40">Security Rule</div>
            <p className="mt-2 text-sm">Only verified <span className="font-semibold">@sbjit.edu.in</span> users can reset passwords.</p>
          </div>
        </section>

        <section className="card p-6 md:p-10">
          <div className="section-eyebrow">Password Recovery</div>
          <h2 className="section-head">{otpRequested ? "Enter OTP and New Password" : "Request Password Reset OTP"}</h2>

          <form className="mt-8 space-y-4" onSubmit={otpRequested ? submitNewPassword : requestResetOtp}>
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

            {otpRequested && (
              <>
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
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-black/40">New Password</label>
                  <input
                    className="input mt-2"
                    type="password"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={form.newPassword}
                    onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-black/40">Confirm New Password</label>
                  <input
                    className="input mt-2"
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

            {message && <div className="text-sm text-emerald-700">{message}</div>}
            {error && <div className="text-sm text-rose-600">{error}</div>}

            <button className="btn btn-primary w-full" type="submit" disabled={sending || resetting}>
              {otpRequested
                ? (resetting ? "Resetting..." : "Verify OTP & Reset Password")
                : (sending ? "Sending OTP..." : "Send Reset OTP")}
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

          <p className="mt-6 text-sm text-black/60">
            Remember your password? <Link className="text-black underline" to="/login">Back to Login</Link>
          </p>
          <p className="mt-2 text-sm text-black/60">
            New user? <Link className="text-black underline" to="/register">Create account</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
