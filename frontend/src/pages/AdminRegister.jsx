import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { handleRegister } from "../lib/auth.jsx";

export default function AdminRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin",
    department: "Administration"
  });
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await handleRegister(form);
      navigate("/login");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen px-3 py-6 sm:px-4 md:px-8 md:py-10 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-6 md:p-10">
          <div className="badge">Incentive Portal</div>
          <h1 className="mt-6 text-3xl font-semibold font-display sm:text-4xl">Admin access registration.</h1>
          <p className="muted mt-3 text-sm">
            Create an administrative account to manage users, applications, and login activity.
          </p>
          <div className="mt-8 space-y-4">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Full Visibility</div>
              <p className="mt-2 text-sm">View users, applications, and security events.</p>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Audit Logs</div>
              <p className="mt-2 text-sm">Track logins and password reset requests.</p>
            </div>
          </div>
        </section>

        <section className="card p-6 md:p-10">
          <div className="text-xs uppercase tracking-[0.2em] text-black/40">Register</div>
          <h2 className="mt-4 text-2xl font-semibold font-display sm:text-3xl">Create admin account</h2>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Full name</label>
              <input className="input mt-2" required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Email</label>
              <input className="input mt-2" type="email" required placeholder="you@college.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Password</label>
              <input className="input mt-2" type="password" required placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Role</label>
              <input className="input mt-2" value="Admin" disabled />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Department</label>
              <input className="input mt-2" value="Administration" disabled />
            </div>
            {error && <div className="text-rose-600 text-sm">{error}</div>}
            <button className="btn btn-primary w-full" type="submit">Register Admin</button>
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
