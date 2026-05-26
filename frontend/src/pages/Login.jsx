import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { handleLogin, useAuth } from "../lib/auth.jsx";
import { getDashboardPathForUser } from "../lib/routeMap.js";

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
    <div className="auth-page">
      <div className="mx-auto w-full max-w-xl">
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
            {successMessage && <div className="text-sm text-emerald-700">{successMessage}</div>}
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
