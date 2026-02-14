import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import { api } from "../lib/api.js";
import { useAuth, logout } from "../lib/auth.jsx";

const menu = [
  "Application Form",
  "My Applications",
  "Application Track",
  "Notifications",
  "Profile",
  "Logout"
];

export default function FacultyDashboard() {
  const { user, setUser } = useAuth();
  const [active, setActive] = useState(menu[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apps, setApps] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [trackId, setTrackId] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [editingDepartment, setEditingDepartment] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [form, setForm] = useState({
    department: "",
    applicantName: "",
    mobileNumber: "",
    email: "",
    designation: "",
    incentiveClaimCount: "00",
    coursePlatform: "",
    courseTitle: "",
    courseSession: "",
    courseWeeks: "",
    courseScore: "",
    courseCategory: "",
    courseCredits: "",
    registrationFeePaid: "",
    permissibleClaim: "",
    feeReceiptFile: null,
    certificateFile: null,
    signatureFile: null,
    declarationAccepted: false
  });
  const [message, setMessage] = useState("");
  const statusLabel = (status) => {
    switch (status) {
      case "pending_department_coordinator":
        return "Dept Coordinator Approval Pending";
      case "pending_department_hod":
        return "Dept HOD Approval Pending";
      case "pending_institution_coordinator":
        return "Institute Coordinator Approval Pending";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      default:
        return status || "-";
    }
  };

  const flowSteps = [
    { key: "pending_department_coordinator", label: "Dept Coordinator" },
    { key: "pending_department_hod", label: "Dept HOD" },
    { key: "pending_institution_coordinator", label: "Institute Coordinator" },
    { key: "approved", label: "Approved" }
  ];

  useEffect(() => {
    api.myApplications().then(setApps).catch(() => setApps([]));
    api.notifications().then(setNotifications).catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      department: prev.department || user.department || "",
      email: prev.email || user.email || ""
    }));
  }, [user]);

  useEffect(() => {
    setDepartmentDraft(user?.department || "");
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    const data = new FormData();
    data.append("department", form.department);
    data.append("applicant_name", form.applicantName);
    data.append("mobile_number", form.mobileNumber);
    data.append("email", form.email);
    data.append("designation", form.designation);
    data.append("incentive_claim_count", String(form.incentiveClaimCount));
    data.append("course_platform", form.coursePlatform);
    data.append("course_title", form.courseTitle);
    data.append("course_session", form.courseSession);
    data.append("course_weeks", String(form.courseWeeks));
    data.append("course_score", form.courseScore);
    data.append("course_category", form.courseCategory);
    data.append("course_credits", String(form.courseCredits));
    data.append("registration_fee_paid", String(form.registrationFeePaid));
    data.append("permissible_claim", String(form.permissibleClaim));
    if (form.feeReceiptFile) data.append("fee_receipt_file", form.feeReceiptFile);
    if (form.certificateFile) data.append("certificate_file", form.certificateFile);
    if (form.signatureFile) data.append("signature_file", form.signatureFile);
    data.append("declaration_accepted", String(form.declarationAccepted));
    await api.submitFaculty(data);
    setForm({
      department: "",
      applicantName: "",
      mobileNumber: "",
      email: "",
      designation: "",
      incentiveClaimCount: "00",
      coursePlatform: "",
      courseTitle: "",
      courseSession: "",
      courseWeeks: "",
      courseScore: "",
      courseCategory: "",
      courseCredits: "",
      registrationFeePaid: "",
      permissibleClaim: "",
      feeReceiptFile: null,
      certificateFile: null,
      signatureFile: null,
      declarationAccepted: false
    });
    setMessage("Application submitted.");
    setApps(await api.myApplications());
  };

  const track = async () => {
    setTrackResult(null);
    const result = await api.track(trackId);
    setTrackResult(result);
  };

  const saveDepartment = async () => {
    const updated = await api.updateProfile({ department: departmentDraft });
    setUser(updated);
    setEditingDepartment(false);
  };

  const handleSelect = (item) => {
    if (item === "Logout") {
      logout(setUser);
      return;
    }
    setActive(item);
  };

  return (
    <div className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8 lg:h-screen lg:overflow-hidden lg:px-10">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-black/40">Engineering</div>
          <div className="text-lg font-semibold font-display">Incentive Portal</div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Menu
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:h-[calc(100vh-4rem)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden lg:sticky lg:top-0 lg:block lg:h-full">
          <Sidebar items={menu} active={active} onSelect={handleSelect} />
        </div>
        <div className="card h-full min-h-0 overflow-y-auto p-6 md:p-8">
          <Topbar title={`Faculty Dashboard`} subtitle={`Hello ${user?.name || ""}`} />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Applications</div>
              <div className="mt-3 text-2xl font-semibold">{apps.length}</div>
              <div className="muted text-xs">Submitted by you</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Notifications</div>
              <div className="mt-3 text-2xl font-semibold">{notifications.length}</div>
              <div className="muted text-xs">Unread + read</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Role</div>
              <div className="mt-3 text-lg font-semibold capitalize">{user?.role || "faculty"}</div>
              <div className="muted text-xs">Active profile</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Department</div>
              <div className="mt-3 text-lg font-semibold">{user?.department || "-"}</div>
              <div className="muted text-xs">Current unit</div>
            </div>
          </div>

                    {active === "Application Form" && (
            <div className="mt-8">
              <div className="panel p-6">
                <h2 className="text-xl font-semibold font-display">Faculty Application Form</h2>
                <p className="muted mt-2 text-sm">Submit the academic year incentive application with full details.</p>
                <form onSubmit={submit} className="mt-8 space-y-8">
                  <div className="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Applicant Details</div>
                      <div className="muted text-xs">Faculty profile</div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Department</label>
                        <input className="input mt-2" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Applicant Name</label>
                        <input className="input mt-2 font-semibold" value={form.applicantName} onChange={(e) => setForm({ ...form, applicantName: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Mobile Number</label>
                        <input className="input mt-2" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Email ID</label>
                        <input className="input mt-2" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Designation</label>
                        <input className="input mt-2" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Incentive Claims This Academic Year</label>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-black/70">
                          {["00", "01", "02"].map((count) => (
                            <label key={count} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="facultyIncentiveClaimCount"
                                value={count}
                                checked={form.incentiveClaimCount === count}
                                onChange={(e) => setForm({ ...form, incentiveClaimCount: e.target.value })}
                              />
                              {count}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Course Details</div>
                      <div className="muted text-xs">Certification information</div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Platform</label>
                        <input className="input mt-2" value={form.coursePlatform} onChange={(e) => setForm({ ...form, coursePlatform: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Title of Course</label>
                        <input className="input mt-2" value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Session</label>
                        <input className="input mt-2" value={form.courseSession} onChange={(e) => setForm({ ...form, courseSession: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Number of Weeks</label>
                        <input className="input mt-2" type="number" min="1" value={form.courseWeeks} onChange={(e) => setForm({ ...form, courseWeeks: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Score</label>
                        <input className="input mt-2" value={form.courseScore} onChange={(e) => setForm({ ...form, courseScore: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Category</label>
                        <input className="input mt-2" value={form.courseCategory} onChange={(e) => setForm({ ...form, courseCategory: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Credits</label>
                        <input className="input mt-2" type="number" min="0" value={form.courseCredits} onChange={(e) => setForm({ ...form, courseCredits: e.target.value })} required />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Registration Details</div>
                      <div className="muted text-xs">Fee + claim</div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Registration Fee Paid (Rs)</label>
                        <input className="input mt-2" type="number" min="0" value={form.registrationFeePaid} onChange={(e) => setForm({ ...form, registrationFeePaid: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Permissible Claim (Rs)</label>
                        <input className="input mt-2" type="number" min="0" value={form.permissibleClaim} onChange={(e) => setForm({ ...form, permissibleClaim: e.target.value })} required />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Documents Attached</div>
                      <div className="muted text-xs">Upload proofs</div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Fee Payment Receipt</label>
                        <input
                          className="input mt-2"
                          type="file"
                          onChange={(e) => setForm({ ...form, feeReceiptFile: e.target.files?.[0] || null })}
                        />
                        {form.feeReceiptFile && <div className="muted mt-1 text-xs">{form.feeReceiptFile?.name}</div>}
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Certificate From Certification Authority</label>
                        <input
                          className="input mt-2"
                          type="file"
                          onChange={(e) => setForm({ ...form, certificateFile: e.target.files?.[0] || null })}
                        />
                        {form.certificateFile && <div className="muted mt-1 text-xs">{form.certificateFile?.name}</div>}
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Signature</label>
                        <input
                          className="input mt-2"
                          type="file"
                          onChange={(e) => setForm({ ...form, signatureFile: e.target.files?.[0] || null })}
                        />
                        {form.signatureFile && <div className="muted mt-1 text-xs">{form.signatureFile?.name}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Declaration</div>
                      <div className="muted text-xs">Required to submit</div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-black/70">
                      <div>1. Credits earned by me shall be assigned to the Institute.</div>
                      <div>2. If excess payment made to me is noticed, I will pay back.</div>
                      <div>3. The information furnished by me is correct.</div>
                    </div>
                    <label className="mt-4 flex items-center gap-2 text-sm text-black/70">
                      <input
                        type="checkbox"
                        checked={form.declarationAccepted}
                        onChange={(e) => setForm({ ...form, declarationAccepted: e.target.checked })}
                        required
                      />
                      I agree to the declaration.
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button className="btn btn-primary" type="submit">Submit Application</button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setForm({
                        department: "",
                        applicantName: "",
                        mobileNumber: "",
                        email: "",
                        designation: "",
                        incentiveClaimCount: "00",
                        coursePlatform: "",
                        courseTitle: "",
                        courseSession: "",
                        courseWeeks: "",
                        courseScore: "",
                        courseCategory: "",
                        courseCredits: "",
                        registrationFeePaid: "",
                        permissibleClaim: "",
                        feeReceiptFile: null,
                        certificateFile: null,
                        signatureFile: null,
                        declarationAccepted: false
                      })}
                    >
                      Clear
                    </button>
                  </div>
                  {message && <p className="text-emerald-600 text-sm">{message}</p>}
                </form>
              </div>
            </div>
          )}

          {active === "My Applications" && (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold font-display">My Applications</h2>
                <div className="muted text-sm">{apps.length} total</div>
              </div>
              <div className="mt-4 grid gap-4">
                {apps.map((app) => (
                  <div key={app.id} className="panel p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{app.data.applicant_name || app.data.project_title}</div>
                      <span className="badge">{statusLabel(app.status)}</span>
                    </div>
                    <div className="muted mt-2 text-xs">ID: {app.id}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {flowSteps.map((step, index) => {
                        const currentIndex = flowSteps.findIndex((s) => s.key === app.status);
                        const reached = app.status === "approved" || currentIndex >= index;
                        const isRejected = app.status === "rejected";
                        return (
                          <span
                            key={step.key}
                            className={`rounded-full px-3 py-1 ${
                              isRejected
                                ? "bg-rose-100 text-rose-700"
                                : reached
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-black/5 text-black/50"
                            }`}
                          >
                            {step.label}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-black/70 md:grid-cols-2">
                      <div><span className="text-black/50">Department:</span> {app.data.department || "-"}</div>
                      <div><span className="text-black/50">Designation:</span> {app.data.designation || "-"}</div>
                      <div><span className="text-black/50">Email:</span> {app.data.email || "-"}</div>
                      <div><span className="text-black/50">Mobile:</span> {app.data.mobile_number || "-"}</div>
                      <div><span className="text-black/50">Course:</span> {app.data.course_title || "-"}</div>
                      <div><span className="text-black/50">Platform:</span> {app.data.course_platform || "-"}</div>
                      <div><span className="text-black/50">Score:</span> {app.data.course_score || "-"}</div>
                      <div><span className="text-black/50">Credits:</span> {app.data.course_credits ?? "-"}</div>
                      <div><span className="text-black/50">Fee Paid:</span> {app.data.registration_fee_paid ?? "-"}</div>
                      <div><span className="text-black/50">Permissible Claim:</span> {app.data.permissible_claim ?? "-"}</div>
                      <div><span className="text-black/50">Approved Amount:</span> {app.data.approved_amount ?? "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "Application Track" && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold font-display">Track Application</h2>
              <p className="muted mt-2 text-sm">Enter the application ID to view the current status.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input className="input flex-1" placeholder="Application ID" value={trackId} onChange={(e) => setTrackId(e.target.value)} />
                <button className="btn btn-ghost" onClick={track}>Track</button>
              </div>
              {trackResult && (
                <div className="mt-4 panel p-4">
                  <div className="text-sm font-semibold">Application {trackResult.id}</div>
                  <div className="muted mt-1 text-sm">Status: {trackResult.status}</div>
                  <div className="muted mt-1 text-sm">Approved Amount: {trackResult.data?.approved_amount ?? "-"}</div>
                </div>
              )}
            </div>
          )}

          {active === "Notifications" && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold font-display">Notifications</h2>
              <div className="mt-4 space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className={`panel p-4 ${n.is_read ? "" : "ring-2 ring-black/20"}`}>
                    <div className="text-sm">{n.message}</div>
                    <div className="muted mt-2 text-xs">{n.is_read ? "Read" : "New"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "Profile" && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold font-display">Profile</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Name</div>
                  <div className="mt-2 text-lg font-semibold">{user?.name}</div>
                </div>
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Email</div>
                  <div className="mt-2 text-sm">{user?.email}</div>
                </div>
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Role</div>
                  <div className="mt-2 text-sm capitalize">{user?.role}</div>
                </div>
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Department</div>
                  {editingDepartment ? (
                    <div className="mt-2 space-y-2">
                      <select
                        className="input"
                        value={departmentDraft}
                        onChange={(e) => setDepartmentDraft(e.target.value)}
                      >
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
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-primary" type="button" onClick={saveDepartment}>Save</button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => {
                            setDepartmentDraft(user?.department || "");
                            setEditingDepartment(false);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-sm">{user?.department}</div>
                      <button className="btn btn-ghost" type="button" onClick={() => setEditingDepartment(true)}>
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {active === "Logout" && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold font-display">Logout</h2>
              <p className="muted mt-2 text-sm">You can sign back in anytime.</p>
              <button className="btn btn-ghost mt-4" onClick={() => logout(setUser)}>Logout</button>
            </div>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-4 right-4 top-6">
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold font-display">Menu</div>
                <button className="btn btn-ghost" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                  Close
                </button>
              </div>
              <div className="mt-4">
                <Sidebar
                  items={menu}
                  active={active}
                  onSelect={(item) => {
                    handleSelect(item);
                    setSidebarOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




