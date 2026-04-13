import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import { api } from "../lib/api.js";
import { useAuth, logout } from "../lib/auth.jsx";
import { getApprovedAmount, withNotificationAmounts } from "../lib/amount.js";

const menu = [
  "Application Form",
  "My Applications",
  "Application Track",
  "Notifications",
  "Feedback",
  "Profile",
  "Delete Account",
  "Logout"
];
const AUTO_REFRESH_MS = 5000;
const MAX_FILE_BYTES = 150 * 1024;
const MAX_FILE_LABEL = "150KB";

export default function StudentDashboard() {
  const { user, setUser } = useAuth();
  const [active, setActive] = useState(menu[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apps, setApps] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({ benefit_status: "beneficial", rating: "5", message: "" });
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [trackId, setTrackId] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [trackMessage, setTrackMessage] = useState("");
  const [editingDepartment, setEditingDepartment] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [form, setForm] = useState({
    department: "",
    applicantName: "",
    usn: "",
    mobileNumber: "",
    academicYear: "",
    semester: "",
    email: "",
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
    bankAccountNumber: "",
    bankIfsc: "",
    bankBranch: "",
    bankName: "",
    feeReceiptFile: null,
    certificateFile: null,
    bankPassbookFile: null,
    signatureFile: null,
    declarationAccepted: false
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
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

  const refreshData = async () => {
    const notificationsData = await api.notifications().catch(() => []);
    const appsData = await api.myApplications().catch(() => []);
    setNotifications(notificationsData);
    setApps(withNotificationAmounts(appsData, notificationsData));
  };

  const loadFeedback = async () => {
    const mine = await api.myFeedback().catch(() => []);
    setFeedbackList(mine);
  };

  useEffect(() => {
    refreshData();
    loadFeedback();
    const interval = setInterval(refreshData, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleToggle = () => setSidebarOpen((prev) => !prev);
    window.addEventListener("portal:toggle-dashboard-menu", handleToggle);
    return () => window.removeEventListener("portal:toggle-dashboard-menu", handleToggle);
  }, []);

  useEffect(() => {
    if (active === "My Applications" || active === "Notifications" || active === "Application Track") {
      refreshData();
    }
    if (active === "Feedback") {
      loadFeedback();
    }
  }, [active]);

  const submitFeedback = async (e) => {
    e.preventDefault();
    setFeedbackMessage("");
    if (feedbackList.length > 0) {
      setFeedbackType("error");
      setFeedbackMessage("Feedback can only be submitted once.");
      return;
    }
    try {
      await api.submitFeedback({
        benefit_status: feedbackForm.benefit_status,
        message: feedbackForm.message.trim(),
        rating: feedbackForm.rating ? Number(feedbackForm.rating) : null
      });
      setFeedbackType("success");
      setFeedbackMessage("Feedback submitted. Thank you.");
      setFeedbackForm({ benefit_status: "beneficial", rating: "5", message: "" });
      await loadFeedback();
    } catch (err) {
      setFeedbackType("error");
      setFeedbackMessage(err.message || "Unable to submit feedback right now.");
    }
  };

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      department: prev.department || user.department || "",
      applicantName: prev.applicantName || user.name || "",
      email: prev.email || user.email || ""
    }));
  }, [user]);

  useEffect(() => {
    setDepartmentDraft(user?.department || "");
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    setMessageType("error");
    const fixedDepartment = user?.department || form.department;
    const fixedApplicantName = user?.name || form.applicantName;
    const fixedEmail = user?.email || form.email;
    const sixMonthsAgoMs = Date.now() - (180 * 24 * 60 * 60 * 1000);
    const recentStudentCount = apps.filter((app) => (
      app.application_type === "student" &&
      app.created_at &&
      new Date(app.created_at).getTime() >= sixMonthsAgoMs
    )).length;
    if (recentStudentCount >= 2) {
      setMessage("Only two student applications are allowed in six months.");
      return;
    }
    const oversizedFiles = [
      form.feeReceiptFile,
      form.certificateFile,
      form.bankPassbookFile,
      form.signatureFile
    ].filter((file) => file && file.size > MAX_FILE_BYTES);
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map((file) => file.name).join(", ");
      setMessage(`File too large. Max ${MAX_FILE_LABEL} per file. Please compress: ${fileNames}`);
      return;
    }
    const data = new FormData();
    data.append("department", fixedDepartment);
    data.append("applicant_name", fixedApplicantName);
    data.append("usn", form.usn);
    data.append("mobile_number", form.mobileNumber);
    data.append("academic_year", form.academicYear);
    data.append("semester", form.semester);
    data.append("email", fixedEmail);
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
    data.append("bank_account_number", form.bankAccountNumber);
    data.append("bank_ifsc", form.bankIfsc);
    data.append("bank_branch", form.bankBranch);
    data.append("bank_name", form.bankName);
    if (form.feeReceiptFile) data.append("fee_receipt_file", form.feeReceiptFile);
    if (form.certificateFile) data.append("certificate_file", form.certificateFile);
    if (form.bankPassbookFile) data.append("bank_passbook_file", form.bankPassbookFile);
    if (form.signatureFile) data.append("signature_file", form.signatureFile);
    data.append("declaration_accepted", String(form.declarationAccepted));
    try {
      await api.submitStudent(data);
      setForm({
        department: user?.department || "",
        applicantName: user?.name || "",
        usn: "",
        mobileNumber: "",
        academicYear: "",
        semester: "",
        email: user?.email || "",
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
        bankAccountNumber: "",
        bankIfsc: "",
        bankBranch: "",
        bankName: "",
        feeReceiptFile: null,
        certificateFile: null,
        bankPassbookFile: null,
        signatureFile: null,
        declarationAccepted: false
      });
      setMessageType("success");
      setMessage("Application submitted.");
      setApps(await api.myApplications());
    } catch (err) {
      const tooLarge = err?.status === 413 || /file too large/i.test(err?.message || "");
      setMessageType("error");
      setMessage(tooLarge ? `File too large. Max ${MAX_FILE_LABEL} per file.` : (err.message || "Failed to submit application."));
    }
  };

  const track = async () => {
    const id = trackId.trim();
    if (!id) {
      setTrackResult(null);
      setTrackMessage("Please enter an application ID.");
      return;
    }
    setTrackMessage("");
    setTrackResult(null);
    try {
      const result = await api.track(id);
      const [enriched] = withNotificationAmounts([result], notifications);
      setTrackResult(enriched || result);
    } catch (err) {
      if (err.status === 404) {
        setTrackMessage("Application not found. Please check the ID and try again.");
        return;
      }
      if (err.status === 401) {
        setTrackMessage("Your session has expired. Please login again.");
        return;
      }
      setTrackMessage(err.message || "Unable to track application right now.");
    }
  };

  const saveDepartment = async () => {
    const updated = await api.updateProfile({ department: departmentDraft });
    setUser(updated);
    setEditingDepartment(false);
  };

  const deleteAccount = async () => {
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;
    setDeleteMessage("");
    setDeletingAccount(true);
    try {
      await api.deleteMe();
      logout(setUser);
    } catch (err) {
      setDeleteMessage(err.message || "Unable to delete account right now.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSelect = (item) => {
    if (item === "Logout") {
      logout(setUser);
      return;
    }
    setActive(item);
  };

  const sixMonthsAgoMs = Date.now() - (180 * 24 * 60 * 60 * 1000);
  const studentSubmissionCountInSixMonths = apps.filter((app) => (
    app.application_type === "student" &&
    app.created_at &&
    new Date(app.created_at).getTime() >= sixMonthsAgoMs
  )).length;
  const studentLimitReached = studentSubmissionCountInSixMonths >= 2;

  return (
    <div className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8 lg:min-h-screen lg:px-10">
      <div className="mx-auto w-full max-w-7xl lg:max-w-none">
        <div className="mb-4 lg:hidden">
          <div>
            <div className="text-lg font-semibold font-display">Incentive Portal</div>
          </div>
        </div>

        <div className="dashboard-shell">
          <div className="dashboard-sidebar">
            <Sidebar items={menu} active={active} onSelect={handleSelect} user={user} />
          </div>
          <div className="card dashboard-content">
          <Topbar title={`Student Portal`} subtitle={`Hello ${user?.name || ""}`} />
          {active !== "Application Form" && (
            <div className="dashboard-kpi-grid">
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
                <div className="mt-3 text-lg font-semibold capitalize">{user?.role || "student"}</div>
                <div className="muted text-xs">Active profile</div>
              </div>
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-black/40">Department</div>
                <div className="mt-3 text-lg font-semibold">{user?.department || "-"}</div>
                <div className="muted text-xs">Current unit</div>
              </div>
            </div>
          )}

          {active === "Application Form" && (
            <div className="mt-8">
              <div className="panel p-6">
                <h2 className="text-xl font-semibold font-display">Student Application Form</h2>
                <p className="muted mt-2 text-sm">Fill in all required fields for the academic year incentive application.</p>
                {studentLimitReached && (
                  <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                    You have already submitted 2 student applications in the last six months. You cannot submit more.
                  </div>
                )}
                <form onSubmit={submit} className="mt-6 space-y-5 pb-24 sm:mt-8 sm:space-y-8">
                  <div className="rounded-3xl border border-black/10 bg-white/60 p-4 sm:p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Applicant Details</div>
                      <div className="muted text-xs">Basic identification</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Department</label>
                        <input className="input mt-2 bg-black/5" value={form.department} readOnly required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Applicant Name</label>
                        <input className="input mt-2 bg-black/5 font-semibold" value={form.applicantName} readOnly required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">USN</label>
                        <input className="input mt-2" value={form.usn} onChange={(e) => setForm({ ...form, usn: e.target.value })} required placeholder="eg., CS23022" />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Mobile Number</label>
                        <input className="input mt-2" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} required placeholder="eg., 9876543210" />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Semester</label>
                        <input className="input mt-2" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} required placeholder="eg., 3" />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Academic Year</label>
                        <input className="input mt-2" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} required placeholder="eg., 2025-2026" />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Email ID</label>
                        <input className="input mt-2 bg-black/5" type="email" value={form.email} readOnly required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Incentive Claims This Academic Year</label>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-black/70">
                          {["00", "01", "02"].map((count) => (
                            <label key={count} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="incentiveClaimCount"
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

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-4 sm:p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Course Details</div>
                      <div className="muted text-xs">Certification information</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Platform</label>
                        <input className="input mt-2" placeholder="e.g., NPTEL, Coursera" value={form.coursePlatform} onChange={(e) => setForm({ ...form, coursePlatform: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Title of Course</label>
                        <input className="input mt-2" placeholder="e.g., GenAI" value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Session</label>
                        <input className="input mt-2" value={form.courseSession} onChange={(e) => setForm({ ...form, courseSession: e.target.value })} required placeholder="2025"/>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Number of Weeks</label>
                        <input className="input mt-2" type="number" min="1" value={form.courseWeeks} onChange={(e) => setForm({ ...form, courseWeeks: e.target.value })} required placeholder="eg., 4"/>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Score</label>
                        <input className="input mt-2" value={form.courseScore} onChange={(e) => setForm({ ...form, courseScore: e.target.value })} required placeholder="eg., 85%"/>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Category</label>
                        <input className="input mt-2" placeholder="eg., Elite, Sliver, Top 1%, etc..." value={form.courseCategory} onChange={(e) => setForm({ ...form, courseCategory: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Credits</label>
                        <input className="input mt-2" type="number" min="0" value={form.courseCredits} onChange={(e) => setForm({ ...form, courseCredits: e.target.value })} required placeholder="eg., 4"/>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-4 sm:p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Registration Details</div>
                      <div className="muted text-xs">Fee + claim</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Registration Fee Paid (Rs)</label>
                        <input className="input mt-2" type="number" min="0" value={form.registrationFeePaid} onChange={(e) => setForm({ ...form, registrationFeePaid: e.target.value })} required placeholder="eg., 1000"/>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Permissible Claim (Rs)</label>
                        <input className="input mt-2" type="number" min="0" value={form.permissibleClaim} onChange={(e) => setForm({ ...form, permissibleClaim: e.target.value })} required placeholder="eg., 500"/>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-4 sm:p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Bank Details</div>
                      <div className="muted text-xs">For reimbursement</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Account Number</label>
                        <input className="input mt-2" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} required placeholder="7994566322111" />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">IFSC Code</label>
                        <input className="input mt-2" value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} required placeholder="eg., IPS00001"/>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Branch</label>
                        <input className="input mt-2" value={form.bankBranch} onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} required placeholder="eg., Gandhi Nagar"/>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Bank Name</label>
                        <input className="input mt-2" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required placeholder="eg., Bank Of India"/>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-4 sm:p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/50">Documents Attached</div>
                      <div className="muted text-xs">Upload proofs</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Fee Payment Receipt (Max 150KB)</label>
                        <input
                          className="input mt-2"
                          type="file"
                          onChange={(e) => setForm({ ...form, feeReceiptFile: e.target.files?.[0] || null })}
                        />
                        {form.feeReceiptFile && <div className="muted mt-1 text-xs">{form.feeReceiptFile?.name}</div>}
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Certificate From Certification Authority (Max 150KB)</label>
                        <input
                          className="input mt-2"
                          type="file"
                          onChange={(e) => setForm({ ...form, certificateFile: e.target.files?.[0] || null })}
                        />
                        {form.certificateFile && <div className="muted mt-1 text-xs">{form.certificateFile?.name}</div>}
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Bank Passbook (Max 150KB)</label>
                        <input
                          className="input mt-2"
                          type="file"
                          onChange={(e) => setForm({ ...form, bankPassbookFile: e.target.files?.[0] || null })}
                        />
                        {form.bankPassbookFile && <div className="muted mt-1 text-xs">{form.bankPassbookFile?.name}</div>}
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Signature (Max 150KB)</label>
                        <input
                          className="input mt-2"
                          type="file"
                          onChange={(e) => setForm({ ...form, signatureFile: e.target.files?.[0] || null })}
                        />
                        {form.signatureFile && <div className="muted mt-1 text-xs">{form.signatureFile?.name}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/60 p-4 sm:p-5 shadow-[0_18px_40px_rgba(15,18,33,0.08)]">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
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

                  <div className="mt-6 rounded-2xl border border-black/10 bg-white/90 p-3 backdrop-blur">
                    <div className="flex flex-wrap gap-3">
                      <button className="btn btn-primary w-full sm:w-auto" type="submit" disabled={studentLimitReached}>
                      {studentLimitReached ? "Limit Reached" : "Submit Application"}
                      </button>
                      <button
                        className="btn btn-ghost w-full sm:w-auto"
                        type="button"
                        onClick={() => setForm({
                          department: user?.department || "",
                          applicantName: user?.name || "",
                          usn: "",
                          mobileNumber: "",
                          semester: "",
                          academicYear: "",
                          email: user?.email || "",
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
                          bankAccountNumber: "",
                          bankIfsc: "",
                          bankBranch: "",
                          bankName: "",
                          feeReceiptFile: null,
                          certificateFile: null,
                          bankPassbookFile: null,
                          signatureFile: null,
                          declarationAccepted: false
                        })}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {message && (
                    <p className={`text-sm ${messageType === "error" ? "text-rose-600" : "text-emerald-600"}`}>
                      {message}
                    </p>
                  )}
                </form>
              </div>
            </div>
          )}

          {active === "My Applications" && (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold font-display">My Applications</h2>
                <div className="flex items-center gap-3">
                  <button className="btn btn-ghost" type="button" onClick={refreshData}>Refresh</button>
                  <div className="muted text-sm">{apps.length} total</div>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                {apps.map((app) => (
                  <div key={app.id} className="panel p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{app.data.applicant_name || app.data.application_name || app.data.title}</div>
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
                      <div><span className="text-black/50">USN:</span> {app.data.usn || "-"}</div>
                      <div><span className="text-black/50">Department:</span> {app.data.department || "-"}</div>
                      <div><span className="text-black/50">Email:</span> {app.data.email || "-"}</div>
                      <div><span className="text-black/50">Mobile:</span> {app.data.mobile_number || "-"}</div>
                      <div><span className="text-black/50">Semester:</span> {app.data.semester || "-"}</div>
                      <div><span className="text-black/50">Academic Year:</span> {app.data.academic_year || "-"}</div>
                      <div><span className="text-black/50">Course:</span> {app.data.course_title || "-"}</div>
                      <div><span className="text-black/50">Platform:</span> {app.data.course_platform || "-"}</div>
                      <div><span className="text-black/50">Score:</span> {app.data.course_score || "-"}</div>
                      <div><span className="text-black/50">Credits:</span> {app.data.course_credits ?? "-"}</div>
                      <div><span className="text-black/50">Fee Paid:</span> {app.data.registration_fee_paid ?? "-"}</div>
                      <div><span className="text-black/50">Permissible Claim:</span> {app.data.permissible_claim ?? "-"}</div>
                      <div><span className="text-black/50">Approved Amount:</span> {getApprovedAmount(app)}</div>
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
              {trackMessage && <div className="mt-3 text-sm text-rose-600">{trackMessage}</div>}
              {trackResult && (
                <div className="mt-4 panel p-4">
                  <div className="text-sm font-semibold">Application {trackResult.id}</div>
                  <div className="muted mt-1 text-sm">Status: {trackResult.status}</div>
                  <div className="muted mt-1 text-sm">Approved Amount: {getApprovedAmount(trackResult)}</div>
                </div>
              )}
            </div>
          )}

          {active === "Notifications" && (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold font-display">Notifications</h2>
                <button className="btn btn-ghost" type="button" onClick={refreshData}>Refresh</button>
              </div>
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

          {active === "Feedback" && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold font-display">Feedback</h2>
              <p className="muted mt-2 text-sm">Share your experience so we can improve the claim workflow.</p>
              <div className="mt-4 panel p-4">
                {feedbackList.length > 0 && (
                  <div className="mb-3 rounded-xl border border-emerald-300/60 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-800">
                    You already submitted feedback. Only one submission is allowed.
                  </div>
                )}
                <form onSubmit={submitFeedback} className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-black/40">
                      Is this website beneficial?
                    </label>
                    <select
                      className="input mt-2"
                      value={feedbackForm.benefit_status}
                      onChange={(e) => setFeedbackForm((prev) => ({ ...prev, benefit_status: e.target.value }))}
                    >
                      <option value="beneficial">Yes, beneficial</option>
                      <option value="partially_beneficial">Partially beneficial</option>
                      <option value="not_beneficial">Not beneficial</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-black/40">Rating</label>
                    <select
                      className="input mt-2"
                      value={feedbackForm.rating}
                      onChange={(e) => setFeedbackForm((prev) => ({ ...prev, rating: e.target.value }))}
                    >
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Good</option>
                      <option value="3">3 - Average</option>
                      <option value="2">2 - Poor</option>
                      <option value="1">1 - Very Poor</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-black/40">Message</label>
                    <textarea
                      className="input mt-2 h-28"
                      value={feedbackForm.message}
                      onChange={(e) => setFeedbackForm((prev) => ({ ...prev, message: e.target.value }))}
                      placeholder="Write your feedback..."
                      required
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={feedbackList.length > 0}>
                    {feedbackList.length > 0 ? "Submitted" : "Submit Feedback"}
                  </button>
                </form>
                {feedbackMessage && (
                  <div className={`mt-3 text-sm ${feedbackType === "error" ? "text-rose-600" : "text-emerald-600"}`}>
                    {feedbackMessage}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {feedbackList.map((item) => (
                  <div key={item.id} className="panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-black/50">
                        Website Benefit: {String(item.benefit_status || "beneficial").replace(/_/g, " ")}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Rating: {item.rating ?? "-"}/5</div>
                      <div className="muted text-xs">{new Date(item.created_at).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-sm text-black/80">{item.message}</div>
                  </div>
                ))}
                {feedbackList.length === 0 && (
                  <div className="muted text-sm">No feedback submitted yet.</div>
                )}
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

          {active === "Delete Account" && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold font-display text-rose-700">Delete Account</h2>
              <p className="mt-2 text-sm text-black/70">
                This permanently deletes your account and related records. This action cannot be undone.
              </p>
              <div className="mt-4 panel border-rose-300/70 bg-rose-50 p-4">
                <button
                  className="btn btn-primary bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
                  type="button"
                  onClick={deleteAccount}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? "Deleting..." : "Delete My Account"}
                </button>
                {deleteMessage && <div className="mt-3 text-sm text-rose-700">{deleteMessage}</div>}
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
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-4 right-4 top-6">
            <div className="card max-h-[80vh] overflow-y-auto p-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold font-display">Menu</div>
                <button className="btn btn-ghost" onClick={() => setSidebarOpen(false)} aria-label="Close menu" type="button">
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
                  user={user}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




