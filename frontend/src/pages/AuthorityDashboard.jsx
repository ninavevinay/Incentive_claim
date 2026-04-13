import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import { api } from "../lib/api.js";
import { useAuth, logout } from "../lib/auth.jsx";
import { getApprovedAmount, getInstitutionCoordinatorApprovedAmount } from "../lib/amount.js";
const API_URL = import.meta.env.VITE_API_URL || "/api";

const baseMenu = [
  "Overview",
  "Pending Applications",
  "My Approved Applications",
  "Total Applications",
  "Feedback",
  "Profile",
  "Delete Account",
  "Logout"
];
const AUTO_REFRESH_MS = 5000;

const ROLE_LABELS = {
  department_coordinator: "Department Coordinator",
  department_hod: "Department HOD",
  institution_coordinator: "Institution Coordinator"
};

export default function AuthorityDashboard() {
  const { user, setUser } = useAuth();
  const [active, setActive] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apps, setApps] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [myApprovedApps, setMyApprovedApps] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({ benefit_status: "beneficial", rating: "5", message: "" });
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [notices, setNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeFile, setNoticeFile] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [message, setMessage] = useState("");
  const [editingDepartment, setEditingDepartment] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [rejectRemarks, setRejectRemarks] = useState({});
  const [approveAmounts, setApproveAmounts] = useState({});
  const menu = user?.role === "institution_coordinator"
    ? [...baseMenu.slice(0, 4), "Notice", ...baseMenu.slice(4)]
    : baseMenu;

  const scopedDepartment = user?.role === "institution_coordinator" ? "" : (user?.department || "");
  const fetchPending = async () => api.pendingApplications(scopedDepartment);
  const fetchAll = async () => api.allApplications(scopedDepartment);

  useEffect(() => {
    if (!user) return;
    fetchPending().then(setApps).catch(() => setApps([]));
    fetchAll().then(setAllApps).catch(() => setAllApps([]));
    api.myReviewedApplications("approve").then(setMyApprovedApps).catch(() => setMyApprovedApps([]));
    api.myFeedback().then(setFeedbackList).catch(() => setFeedbackList([]));
    api.publicNotices().then(setNotices).catch(() => setNotices([]));
    const interval = setInterval(() => {
      fetchPending().then(setApps).catch(() => setApps([]));
      fetchAll().then(setAllApps).catch(() => setAllApps([]));
      api.myReviewedApplications("approve").then(setMyApprovedApps).catch(() => setMyApprovedApps([]));
      api.publicNotices().then(setNotices).catch(() => setNotices([]));
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    setDepartmentDraft(user?.department || "");
  }, [user]);

  const refresh = async () => {
    setApps(await fetchPending().catch(() => []));
    setAllApps(await fetchAll().catch(() => []));
    setMyApprovedApps(await api.myReviewedApplications("approve").catch(() => []));
    setNotices(await api.publicNotices().catch(() => []));
  };

  const loadFeedback = async () => {
    const mine = await api.myFeedback().catch(() => []);
    setFeedbackList(mine);
  };

  const refreshApprovedOnly = async () => {
    setMyApprovedApps(await api.myReviewedApplications("approve").catch(() => []));
  };

  useEffect(() => {
    if (!menu.includes(active)) {
      setActive("Overview");
    }
  }, [user?.role, active]);

  useEffect(() => {
    if (active === "My Approved Applications") {
      refreshApprovedOnly();
    }
    if (active === "Feedback") {
      loadFeedback();
    }
  }, [active]);

  useEffect(() => {
    const handleToggle = () => setSidebarOpen((prev) => !prev);
    window.addEventListener("portal:toggle-dashboard-menu", handleToggle);
    return () => window.removeEventListener("portal:toggle-dashboard-menu", handleToggle);
  }, []);

  const normalize = (value) => (value || "").trim().toLowerCase();
  const scopedAllApps = user?.role === "institution_coordinator"
    ? allApps
    : allApps.filter((app) => normalize(app.data?.department) === normalize(user?.department));

  const localApprovedByMeApps = scopedAllApps.filter((app) => {
    const reviews = app.data?.reviews || [];
    const strictMatch = reviews.some(
      (review) =>
        review?.action === "approve" &&
        review?.reviewer_id !== undefined &&
        review?.reviewer_id !== null &&
        String(review.reviewer_id) === String(user?.id)
    );
    if (strictMatch) return true;
    return reviews.some(
      (review) =>
        review?.action === "approve" &&
        review?.role === user?.role &&
        (review?.reviewer_id === undefined || review?.reviewer_id === null)
    );
  });

  const mergeById = (primary, fallback) => {
    const map = new Map();
    // Keep primary API records authoritative; fallback fills only missing IDs.
    [...fallback, ...primary].forEach((app) => {
      if (app && app.id !== undefined && app.id !== null) {
        map.set(app.id, app);
      }
    });
    return Array.from(map.values());
  };

  const approvedByMeApps = mergeById(myApprovedApps, localApprovedByMeApps);
  const rejectedAppsCount = scopedAllApps.filter((app) => app.status === "rejected").length;
  const review = async (id, action) => {
    setMessage("");
    try {
      const remark = action === "reject" ? (rejectRemarks[id] || "").trim() : null;
      const approvedAmountRaw = approveAmounts[id];
      const approvedAmount = approvedAmountRaw !== undefined && approvedAmountRaw !== ""
        ? Number(approvedAmountRaw)
        : null;
      if (action === "reject" && !remark) {
        setMessage("Rejection remark is required.");
        return;
      }
      if (action === "approve" && user?.role === "institution_coordinator") {
        if (approvedAmount === null || Number.isNaN(approvedAmount) || approvedAmount < 0) {
          setMessage("Approved amount is required for institution coordinator.");
          return;
        }
      }
      await api.reviewApplication(id, action, remark, approvedAmount);
      setRejectRemarks((prev) => ({ ...prev, [id]: "" }));
      setApproveAmounts((prev) => ({ ...prev, [id]: "" }));
      setMessage(`Application ${action}d.`);
      await refresh();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const exportApprovedApplicationsPdf = async () => {
    const liveAll = await fetchAll().catch(() => scopedAllApps);
    setAllApps(liveAll);
    const approvedRows = (Array.isArray(liveAll) ? liveAll : []).filter((app) => app.status === "approved");
    const studentApproved = approvedRows.filter((app) => app.application_type === "student");
    const facultyApproved = approvedRows.filter((app) => app.application_type === "faculty");
    const escapeHtml = (value) =>
      String(value ?? "-")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const amountAsNumber = (app) => {
      const amount = Number(getInstitutionCoordinatorApprovedAmount(app));
      return Number.isFinite(amount) ? amount : 0;
    };
    const formatAmount = (value) => Number(value || 0).toFixed(2);
    const studentTotal = studentApproved.reduce((sum, app) => sum + amountAsNumber(app), 0);
    const facultyTotal = facultyApproved.reduce((sum, app) => sum + amountAsNumber(app), 0);
    const grandTotal = studentTotal + facultyTotal;

    const studentRowsHtml = studentApproved
      .map((app, index) => {
        const data = app.data || {};
        const name = data.applicant_name || data.application_name || "-";
        const contactNumber = data.mobile_number || "-";
        const department = data.department || "-";
        const accountNumber = data.bank_account_number || "-";
        const ifsc = data.bank_ifsc || "-";
        const bankNameAndBranch = [data.bank_name || "-", data.bank_branch || "-"].join(" / ");
        const amount = getInstitutionCoordinatorApprovedAmount(app);
        return `<tr>
          <td>${escapeHtml(index + 1)}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(contactNumber)}</td>
          <td>${escapeHtml(department)}</td>
          <td>${escapeHtml(accountNumber)}</td>
          <td>${escapeHtml(ifsc)}</td>
          <td>${escapeHtml(bankNameAndBranch)}</td>
          <td>${escapeHtml(amount)}</td>
        </tr>`;
      })
      .join("");

    const facultyRowsHtml = facultyApproved
      .map((app, index) => {
        const data = app.data || {};
        const applicationName = data.application_name || data.applicant_name || "-";
        const contactNumber = data.mobile_number || "-";
        const department = data.department || "-";
        const designation = data.designation || "-";
        const amount = getInstitutionCoordinatorApprovedAmount(app);
        return `<tr>
          <td>${escapeHtml(index + 1)}</td>
          <td>${escapeHtml(applicationName)}</td>
          <td>${escapeHtml(contactNumber)}</td>
          <td>${escapeHtml(department)}</td>
          <td>${escapeHtml(designation)}</td>
          <td>${escapeHtml(amount)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Approved Applications Report</title>
    <style>
      body { font-family: "Times New Roman", Times, serif; font-size: 12px; padding: 24px; }
      h1 { margin-bottom: 4px; }
      p { color: #5a5146; margin-top: 0; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 18px; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
      th { background: #f3f3f3; font-weight: 700; }
      h1, h2 { font-size: 16px; font-weight: 700; }
      h2 { margin-top: 18px; margin-bottom: 8px; }
    </style>
  </head>
  <body>
    <h1>Approved Applications Report</h1>
    <p>Institution Coordinator - ${new Date().toLocaleString()}</p>
    <p>
      Student Applicants: ${escapeHtml(studentApproved.length)} |
      Faculty Applicants: ${escapeHtml(facultyApproved.length)} |
      Grand Total Amount (Rs): ${escapeHtml(formatAmount(grandTotal))}
    </p>
    <h2>Student Applications</h2>
    <table>
      <thead>
        <tr>
          <th>Sr No</th>
          <th>Applicant Name</th>
          <th>Contact Number</th>
          <th>Department</th>
          <th>Account Number</th>
          <th>IFSC Code</th>
          <th>Bank Name And Branch</th>
          <th>Approved Amount</th>
        </tr>
      </thead>
      <tbody>
        ${studentRowsHtml || '<tr><td colspan="8">No approved student applications.</td></tr>'}
        <tr>
          <td colspan="7" style="text-align:right;font-weight:700">Student Total (Rs)</td>
          <td style="font-weight:700">${escapeHtml(formatAmount(studentTotal))}</td>
        </tr>
      </tbody>
    </table>
    <h2>Faculty Applications</h2>
    <table>
      <thead>
        <tr>
          <th>Sr No</th>
          <th>Application Name</th>
          <th>Contact Number</th>
          <th>Department</th>
          <th>Designation</th>
          <th>Approved Amount</th>
        </tr>
      </thead>
      <tbody>
        ${facultyRowsHtml || '<tr><td colspan="6">No approved faculty applications.</td></tr>'}
        <tr>
          <td colspan="5" style="text-align:right;font-weight:700">Faculty Total (Rs)</td>
          <td style="font-weight:700">${escapeHtml(formatAmount(facultyTotal))}</td>
        </tr>
      </tbody>
    </table>
    <h2>Overall Total Amount (Rs): ${escapeHtml(formatAmount(grandTotal))}</h2>
  </body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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

  const submitNotice = async (e) => {
    e.preventDefault();
    setNoticeMessage("");
    try {
      const title = noticeTitle.trim();
      if (!title) {
        setNoticeMessage("Notice title is required.");
        return;
      }
      if (!noticeFile) {
        setNoticeMessage("Notice file is required.");
        return;
      }
      const data = new FormData();
      data.append("title", title);
      data.append("notice_file", noticeFile);
      await api.createNotice(data);
      setNoticeTitle("");
      setNoticeFile(null);
      setNoticeMessage("Notice uploaded.");
      await refresh();
    } catch (err) {
      setNoticeMessage(err.message);
    }
  };

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

  const docLink = (path) => {
    if (!path) return "-";
    const href = path.startsWith("http") ? path : `${API_URL}${path}`;
    return (
      <a className="text-black underline" href={href} target="_blank" rel="noreferrer">
        View
      </a>
    );
  };

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
          <Topbar title={`Authority Portal`} subtitle={`Hello ${user?.name || ""}`} />
          {active === "Overview" && (
            <div className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Pending</div>
                  <div className="mt-3 text-2xl font-semibold">{apps.length}</div>
                  <div className="muted text-xs">Awaiting your action</div>
                </div>
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Total Applications</div>
                  <div className="mt-3 text-2xl font-semibold">{scopedAllApps.length}</div>
                  <div className="muted text-xs">In your scope</div>
                </div>
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Role</div>
                  <div className="mt-3 text-lg font-semibold">{ROLE_LABELS[user?.role] || user?.role}</div>
                  <div className="muted text-xs">Active profile</div>
                </div>
                <div className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Department</div>
                  <div className="mt-3 text-lg font-semibold">{user?.department || "-"}</div>
                  <div className="muted text-xs">Assigned unit</div>
                </div>
              </div>

              <div className="mt-6 panel p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-black/40">Overview</div>
                    <h3 className="mt-2 text-lg font-semibold font-display">Applications Summary</h3>
                  </div>
                  <div className="text-xs text-black/50">Live counts</div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    { label: "Pending", value: apps.length },
                    { label: "Total", value: scopedAllApps.length },
                    { label: "My Approved", value: approvedByMeApps.length },
                    { label: "Rejected", value: rejectedAppsCount }
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>{item.label}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-black/10">
                        <div
                          className="h-2 rounded-full bg-black/80"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (item.value / Math.max(scopedAllApps.length, 1)) * 100
                              )
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {active === "Pending Applications" && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold font-display">Pending Applications</h2>
                <button className="btn btn-ghost" type="button" onClick={refresh}>Refresh</button>
              </div>
              {message && <div className="mt-3 text-sm text-emerald-700">{message}</div>}
              <div className="mt-4 grid gap-4">
                {apps.map((app) => (
                  <div key={app.id} className="panel p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{app.data.applicant_name || app.data.application_name || "-"}</div>
                      <span className="badge">{app.status}</span>
                    </div>
                    <div className="muted mt-2 text-xs">ID: {app.id}</div>
                    <div className="mt-4 grid gap-3 text-sm text-black/70 md:grid-cols-2">
                      <div><span className="text-black/50">Application Type:</span> {app.application_type || "-"}</div>
                      <div><span className="text-black/50">Applicant Name:</span> {app.data.applicant_name || app.data.application_name || "-"}</div>
                      <div><span className="text-black/50">Department:</span> {app.data.department || "-"}</div>
                      <div><span className="text-black/50">USN:</span> {app.data.usn || "-"}</div>
                      <div><span className="text-black/50">Email:</span> {app.data.email || "-"}</div>
                      <div><span className="text-black/50">Mobile:</span> {app.data.mobile_number || "-"}</div>
                      <div><span className="text-black/50">Designation:</span> {app.data.designation || "-"}</div>
                      <div><span className="text-black/50">Semester:</span> {app.data.semester || "-"}</div>
                      <div><span className="text-black/50">Academic Year:</span> {app.data.academic_year || "-"}</div>
                      <div><span className="text-black/50">Claims:</span> {app.data.incentive_claim_count ?? "-"}</div>
                      <div><span className="text-black/50">Course:</span> {app.data.course_title || "-"}</div>
                      <div><span className="text-black/50">Platform:</span> {app.data.course_platform || "-"}</div>
                      <div><span className="text-black/50">Session:</span> {app.data.course_session || "-"}</div>
                      <div><span className="text-black/50">Weeks:</span> {app.data.course_weeks ?? "-"}</div>
                      <div><span className="text-black/50">Score:</span> {app.data.course_score || "-"}</div>
                      <div><span className="text-black/50">Category:</span> {app.data.course_category || "-"}</div>
                      <div><span className="text-black/50">Credits:</span> {app.data.course_credits ?? "-"}</div>
                      <div><span className="text-black/50">Fee Paid:</span> {app.data.registration_fee_paid ?? "-"}</div>
                      <div><span className="text-black/50">Permissible Claim:</span> {app.data.permissible_claim ?? "-"}</div>
                      <div><span className="text-black/50">Bank Account Number:</span> {app.data.bank_account_number || "-"}</div>
                      <div><span className="text-black/50">Bank IFSC:</span> {app.data.bank_ifsc || "-"}</div>
                      <div><span className="text-black/50">Bank Branch:</span> {app.data.bank_branch || "-"}</div>
                      <div><span className="text-black/50">Bank Name:</span> {app.data.bank_name || "-"}</div>
                      <div><span className="text-black/50">Declaration Accepted:</span> {app.data.declaration_accepted ? "Yes" : "No"}</div>
                      <div><span className="text-black/50">Fee Receipt:</span> {docLink(app.data.fee_receipt_file)}</div>
                      <div><span className="text-black/50">Certificate:</span> {docLink(app.data.certificate_file)}</div>
                      <div><span className="text-black/50">Bank Passbook:</span> {docLink(app.data.bank_passbook_file)}</div>
                      <div><span className="text-black/50">Signature:</span> {docLink(app.data.signature_file)}</div>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs uppercase tracking-[0.2em] text-black/40">Rejection Remark (required)</label>
                      <textarea
                        className="input mt-2 h-24"
                        value={rejectRemarks[app.id] || ""}
                        onChange={(e) => setRejectRemarks((prev) => ({ ...prev, [app.id]: e.target.value }))}
                      />
                    </div>
                    {user?.role === "institution_coordinator" && (
                      <div className="mt-4">
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Approved Amount (Rs)</label>
                        <input
                          className="input mt-2"
                          type="number"
                          min="0"
                          step="0.01"
                          value={approveAmounts[app.id] || ""}
                          onChange={(e) => setApproveAmounts((prev) => ({ ...prev, [app.id]: e.target.value }))}
                        />
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button className="btn btn-primary" type="button" onClick={() => review(app.id, "approve")}>Approve</button>
                      <button className="btn btn-ghost" type="button" onClick={() => review(app.id, "reject")}>Reject</button>
                    </div>
                  </div>
                ))}
                {apps.length === 0 && (
                  <div className="muted text-sm">No pending applications.</div>
                )}
              </div>
            </div>
          )}

          {active === "My Approved Applications" && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold font-display">My Approved Applications</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn btn-ghost" type="button" onClick={refreshApprovedOnly}>Refresh</button>
                  {user?.role === "institution_coordinator" && (
                    <button className="btn btn-ghost" type="button" onClick={exportApprovedApplicationsPdf}>
                      Export PDF
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                {approvedByMeApps.map((app) => (
                  <div key={app.id} className="panel p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{app.data.applicant_name || app.data.application_name || "-"}</div>
                      <span className="badge">{app.status}</span>
                    </div>
                    <div className="muted mt-2 text-xs">ID: {app.id}</div>
                    <div className="mt-3 text-sm text-black/70">
                      <span className="text-black/50">Department:</span> {app.data.department || "-"}
                    </div>
                    {user?.role === "institution_coordinator" && (
                      <div className="mt-2 text-sm text-black/70">
                        <span className="text-black/50">Approved Amount:</span> {getInstitutionCoordinatorApprovedAmount(app)}
                      </div>
                    )}
                  </div>
                ))}
                {approvedByMeApps.length === 0 && (
                  <div className="muted text-sm">No applications found with your approval record.</div>
                )}
              </div>
            </div>
          )}

          {active === "Total Applications" && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold font-display">Total Applications</h2>
              <div className="mt-4 grid gap-4">
                {scopedAllApps.map((app) => (
                  <div key={app.id} className="panel p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{app.data.applicant_name || app.data.application_name || "-"}</div>
                      <span className="badge">{app.status}</span>
                    </div>
                    <div className="muted mt-2 text-xs">ID: {app.id}</div>
                    <div className="mt-3 text-sm text-black/70">
                      <span className="text-black/50">Department:</span> {app.data.department || "-"}
                    </div>
                  </div>
                ))}
                {scopedAllApps.length === 0 && (
                  <div className="muted text-sm">No applications.</div>
                )}
              </div>
            </div>
          )}

          {active === "Notice" && user?.role === "institution_coordinator" && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold font-display">Notice</h2>
                <button className="btn btn-ghost" type="button" onClick={refresh}>Refresh</button>
              </div>
              <div className="mt-4 panel p-4">
                <form onSubmit={submitNotice} className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-black/40">Notice Title</label>
                    <input
                      className="input mt-2"
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      placeholder="Enter notice title"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-black/40">Notice File</label>
                    <input
                      className="input mt-2"
                      type="file"
                      onChange={(e) => setNoticeFile(e.target.files?.[0] || null)}
                      required
                    />
                    {noticeFile && <div className="muted mt-1 text-xs">{noticeFile.name}</div>}
                  </div>
                  <button className="btn btn-primary" type="submit">Submit Notice</button>
                </form>
                {noticeMessage && <div className="mt-3 text-sm text-emerald-700">{noticeMessage}</div>}
              </div>

              <div className="mt-4 grid gap-4">
                {notices.map((notice) => (
                  <div key={notice.id} className="panel p-4">
                    <div className="font-semibold">{notice.title}</div>
                    <div className="muted mt-1 text-xs">
                      {new Date(notice.created_at).toLocaleString()}
                    </div>
                    <div className="mt-2 text-sm">
                      {docLink(notice.file_path)}
                    </div>
                  </div>
                ))}
                {notices.length === 0 && (
                  <div className="muted text-sm">No notices uploaded.</div>
                )}
              </div>
            </div>
          )}

          {active === "Feedback" && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold font-display">Feedback</h2>
              <p className="muted mt-2 text-sm">Share your experience so we can improve the review workflow.</p>
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
                  <div className="mt-2 text-sm">{ROLE_LABELS[user?.role] || user?.role}</div>
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
