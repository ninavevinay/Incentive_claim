import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { handleRegister } from "../lib/auth.jsx";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
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
      <div className="auth-shell">
        <section className="card p-6 md:p-10">
          <div className="badge">Claim Portal</div>
          <h1 className="mt-6 text-3xl font-semibold font-display sm:text-4xl">Create your incentive account</h1>
          <p className="muted mt-3 text-sm">Start your claim journey with role-based access and guided forms.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Step 1</div>
              <div className="kpi-value">Profile</div>
              <p className="mt-1 text-xs text-black/60">Create your verified account</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Step 2</div>
              <div className="kpi-value">Submit</div>
              <p className="mt-1 text-xs text-black/60">Upload course and fee documents</p>
            </div>
            <div className="kpi">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Step 3</div>
              <div className="kpi-value">Track</div>
              <p className="mt-1 text-xs text-black/60">Follow approvals in real time</p>
            </div>
          </div>
          <div className="mt-6 panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/40">Workflow</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="claim-pill">Student / Faculty</span>
              <span className="claim-pill">Department Coordinator</span>
              <span className="claim-pill">HOD</span>
              <span className="claim-pill">Institution Coordinator</span>
            </div>
          </div>
        </section>

        <section className="card p-6 md:p-10">
          <div className="section-eyebrow">Claim Registration</div>
          <h2 className="section-head">Create account</h2>
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
              <select className="input mt-2" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
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
            <button className="btn btn-primary w-full" type="submit">Register</button>
          </form>
          <p className="mt-6 text-sm text-black/60">
            Already have an account? <Link className="text-black underline" to="/login">Login</Link>
          </p>
          
        </section>
      </div>
    </div>
  );
}
