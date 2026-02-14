import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { handleRegister } from "../lib/auth.jsx";

export default function AuthorityRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "department_coordinator",
    department: ""
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
          <h1 className="mt-6 text-3xl font-semibold font-display sm:text-4xl">Create your incentive profile.</h1>
          <p className="muted mt-3 text-sm">
            Register once to unlock student and faculty workflows with role-based dashboards.
          </p>
          <div className="mt-8 space-y-4">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Smart Routing</div>
              <p className="mt-2 text-sm">Your department and role map to the right approvals.</p>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Instant Tracking</div>
              <p className="mt-2 text-sm">Track submissions without emailing admins.</p>
            </div>
          </div>
        </section>

        <section className="card p-6 md:p-10">
          <div className="text-xs uppercase tracking-[0.2em] text-black/40">Register</div>
          <h2 className="mt-4 text-2xl font-semibold font-display sm:text-3xl">Create account</h2>
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
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Authority Role</label>
              <select className="input mt-2" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="department_coordinator">Department Coordinator</option>
                <option value="department_hod">Department HOD</option>
                <option value="institution_coordinator">Institution Coordinator</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-black/40">Department</label>
              <select className="input mt-2" required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="" disabled>Select department</option>
                <option value="First Year">First Year</option>
                <option value="CSE">CSE</option>
                <option value="AIML">AIML</option>
                <option value="AIDS">AIDS</option>
                <option value="ETC">ETC</option>
                <option value="IT">IT</option>
                <option value="EE">EE</option>
                <option value="ME">ME</option>
                <option value="CA (Computer Applications)">CA (Computer Applications)</option>
                <option value="BA (Business Administration)">BA (Business Administration)</option>
              </select>
            </div>
            {error && <div className="text-rose-600 text-sm">{error}</div>}
            <button className="btn btn-primary w-full" type="submit">Register Authority</button>
          </form>
          <p className="mt-6 text-sm text-black/60">
            Already have an account? <Link className="text-black underline" to="/login">Login</Link>
          </p>
          <p className="mt-2 text-sm text-black/60">
            Student/Faculty registration? <Link className="text-black underline" to="/register">Go to Register</Link>
          </p>
          <p className="mt-2 text-sm text-black/60">
            Admin registration? <Link className="text-black underline" to="/register-admin">Register admin</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
