import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { handleLogin, useAuth } from "../lib/auth.jsx";
import { getDashboardPathForUser } from "../lib/routeMap.js";
import { AuthShell } from "../components/layout/index.js";

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const message = location.state?.successMessage;
    if (!message) return;
    setSuccessMessage(String(message));
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

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
    <AuthShell
      eyebrow="Secure Access"
      title="Sign in to your portal"
      subtitle="Use your verified @sbjit.edu.in email and password to access the reimbursement workspace."
    >
      <form className="space-y-4" onSubmit={submitLogin}>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            College Email
          </label>
          <input
            className="input"
            type="email"
            required
            placeholder="you@sbjit.edu.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {successMessage && <div className="alert-success">{successMessage}</div>}
        {error && <div className="alert-error">{error}</div>}
        <button className="btn btn-primary w-full" type="submit" disabled={loggingIn}>
          {loggingIn ? "Signing In..." : "Sign In"}
        </button>
      </form>
      <p className="mt-5 text-sm text-slate-500">
        Forgot password?{" "}
        <Link className="font-semibold text-[color:var(--primary-soft)] hover:underline" to="/forgot-password">
          Reset with OTP
        </Link>
      </p>
      <p className="mt-3 text-sm text-slate-500">
        No account?{" "}
        <Link className="font-semibold text-[color:var(--primary-soft)] hover:underline" to="/register">
          Register
        </Link>
      </p>
    </AuthShell>
  );
}
