import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import DashboardMobileSidebar from "../components/DashboardMobileSidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import ApplicationDetailsPopup from "../components/ApplicationDetailsPopup.jsx";
import SubmitStatusPopup from "../components/SubmitStatusPopup.jsx";
import DangerConfirmPopup from "../components/DangerConfirmPopup.jsx";
import { api } from "../lib/api.js";
import { useAuth, logout } from "../lib/auth.jsx";
import { getApprovedAmount, withNotificationAmounts } from "../lib/amount.js";
import { formatAcademicYear, isAcademicYearFormat, normalizeAcademicYear } from "../lib/academicYear.js";
import { exportApplicationFormPdf } from "../lib/applicationFormPdf.js";
import { getStoredMenuSelection, setStoredMenuSelection } from "../lib/dashboardStorage.js";
import {
  COURSE_CATEGORY_OPTIONS,
  normalizeCourseCategory,
  shouldShowCourseDetails,
  shouldShowRegistrationDetails
} from "../lib/courseCategories.js";

const menu = [
  "Application Form",
  "My Applications",
  "Feedback",
  "Profile",
  "Delete Account",
  "Logout"
];
const AUTO_REFRESH_MS = 30000;
const DASHBOARD_FETCH_LIMIT = 60;
const MAX_FILE_BYTES = 150 * 1024;
const MAX_FILE_LABEL = "150KB";
const ACTIVE_TAB_STORAGE_KEY = "incentive:faculty:active-tab";

export default function FacultyDashboard() {
  const { user, setUser } = useAuth();
  const [active, setActive] = useState(() =>
    getStoredMenuSelection(ACTIVE_TAB_STORAGE_KEY, menu[0], menu)
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apps, setApps] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({ benefit_status: "beneficial", rating: "5", message: "" });
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [editingDepartment, setEditingDepartment] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [form, setForm] = useState({
    department: "",
    applicantName: "",
    mobileNumber: "",
    academicYear: "",
    academicYearType: "ODD",
    email: "",
    designation: "",
    incentiveClaimCount: "00",
    coursePlatform: "",
    courseTitle: "",
    nptelApplicationNumber: "",
    courseSession: "",
    courseWeeks: "",
    courseScore: "",
    courseCategory: "",
    courseCredits: "",
    registrationFeePaid: "",
    permissibleClaim: "",
    feeReceiptFile: null,
    certificateFile: null,
    photographFile: null,
    declarationAccepted: false
  });
  const [submitPopup, setSubmitPopup] = useState({
    open: false,
    type: "success",
    title: "",
    message: ""
  });
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const submittingApplicationRef = useRef(false);
  const [applicationsNotice, setApplicationsNotice] = useState("");
  const [applicationsNoticeType, setApplicationsNoticeType] = useState("success");
  const courseSectionsRef = useRef(null);
  const previousCourseCategoryRef = useRef(form.courseCategory);
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
    const appsData = await api.myApplications({ limit: DASHBOARD_FETCH_LIMIT }).catch(() => []);
    setApps(withNotificationAmounts(appsData, []));
  };

  const loadFeedback = async () => {
    const mine = await api.myFeedback().catch(() => []);
    setFeedbackList(mine);
  };

  useEffect(() => {
    refreshData();
    loadFeedback();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (active === "Feedback") {
        loadFeedback();
        return;
      }
      refreshData();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    const refreshOnFocus = () => {
      refreshData();
      loadFeedback();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshOnFocus();
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleToggle = () => setSidebarOpen((prev) => !prev);
    window.addEventListener("portal:toggle-dashboard-menu", handleToggle);
    return () => window.removeEventListener("portal:toggle-dashboard-menu", handleToggle);
  }, []);

  useEffect(() => {
    if (active === "My Applications") {
      refreshData();
    }
    if (active === "Feedback") {
      loadFeedback();
    }
  }, [active]);

  useEffect(() => {
    if (!menu.includes(active)) {
      setActive(menu[0]);
      return;
    }
    setStoredMenuSelection(ACTIVE_TAB_STORAGE_KEY, active);
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
      applicantName: toUpperText(prev.applicantName || user.name || ""),
      email: prev.email || normalizeEmail(user.email || "")
    }));
  }, [user]);

  useEffect(() => {
    setDepartmentDraft(user?.department || "");
  }, [user]);

  const toUpperText = (value) => String(value || "").toUpperCase();
  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const hasDisplayText = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return false;
    const lowered = text.toLowerCase();
    return text !== "-" && lowered !== "not provided" && lowered !== "n/a";
  };
  const closeSubmitPopup = () => setSubmitPopup((prev) => ({ ...prev, open: false }));
  const showSubmitPopup = (type, popupMessage, title = "") => {
    setSubmitPopup({
      open: true,
      type,
      title,
      message: popupMessage
    });
  };
  const showCourseDetails = shouldShowCourseDetails(form.courseCategory);
  const showRegistrationDetails = shouldShowRegistrationDetails(form.courseCategory);
  useEffect(() => {
    const previousCategory = previousCourseCategoryRef.current;
    previousCourseCategoryRef.current = form.courseCategory;
    if (!showCourseDetails || previousCategory === form.courseCategory) return;
    courseSectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [form.courseCategory, showCourseDetails]);
  const viewApplicationsFromPopup = () => {
    closeSubmitPopup();
    setActive("My Applications");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submittingApplicationRef.current) {
      showSubmitPopup("error", "Application submission is in progress. Please wait.", "Please wait");
      return;
    }
    const fixedDepartment = toUpperText(user?.department || form.department);
    const fixedApplicantName = toUpperText(user?.name || form.applicantName);
    const fixedEmail = normalizeEmail(user?.email || form.email);
    const academicYear = normalizeAcademicYear(form.academicYear);
    if (!normalizeCourseCategory(form.courseCategory)) {
      showSubmitPopup("error", "Please select a course category before submitting.", "Category required");
      return;
    }
    if (!isAcademicYearFormat(academicYear)) {
      showSubmitPopup("error", "Academic year must be in 2023 - 2024 format.", "Academic year required");
      return;
    }
    const sixMonthsAgoMs = Date.now() - (180 * 24 * 60 * 60 * 1000);
    const recentFacultyCount = apps.filter((app) => (
      app.application_type === "faculty" &&
      app.created_at &&
      new Date(app.created_at).getTime() >= sixMonthsAgoMs
    )).length;
    if (false) {
      showSubmitPopup("error", "Only two faculty applications are allowed in six months.", "Submission blocked");
      return;
    }
    const oversizedFiles = [
      ...(showCourseDetails ? [form.feeReceiptFile] : []),
      form.certificateFile,
      form.photographFile
    ].filter((file) => file && file.size > MAX_FILE_BYTES);
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map((file) => file.name).join(", ");
      showSubmitPopup(
        "error",
        `File too large. Max ${MAX_FILE_LABEL} per file. Please compress: ${fileNames}`,
        "Upload issue"
      );
      return;
    }
    const data = new FormData();
    data.append("department", fixedDepartment);
    data.append("applicant_name", fixedApplicantName);
    data.append("mobile_number", toUpperText(form.mobileNumber));
    data.append("academic_year", academicYear);
    data.append("academic_year_type", toUpperText(form.academicYearType));
    data.append("email", fixedEmail);
    data.append("designation", toUpperText(form.designation));
    data.append("incentive_claim_count", String(form.incentiveClaimCount));
    data.append("course_category", toUpperText(form.courseCategory));
    if (showRegistrationDetails) {
      data.append("registration_fee_paid", String(form.registrationFeePaid));
      data.append("permissible_claim", String(form.permissibleClaim));
    }
    if (showCourseDetails) {
      data.append("course_platform", toUpperText(form.coursePlatform));
      data.append("course_title", toUpperText(form.courseTitle));
      data.append("nptel_application_number", toUpperText(form.nptelApplicationNumber));
      data.append("course_session", toUpperText(form.courseSession));
      data.append("course_weeks", String(form.courseWeeks));
      data.append("course_score", toUpperText(form.courseScore));
      data.append("course_credits", String(form.courseCredits));
      if (form.feeReceiptFile) data.append("fee_receipt_file", form.feeReceiptFile);
    }
    if (form.certificateFile) data.append("certificate_file", form.certificateFile);
    if (form.photographFile) data.append("photograph_file", form.photographFile);
    data.append("declaration_accepted", String(form.declarationAccepted));
    submittingApplicationRef.current = true;
    setIsSubmittingApplication(true);
    try {
      await api.submitFaculty(data);
      setForm({
        department: user?.department || "",
        applicantName: user?.name || "",
        mobileNumber: "",
        academicYear: "",
        academicYearType: "ODD",
        email: normalizeEmail(user?.email || ""),
        designation: "",
        incentiveClaimCount: "00",
        coursePlatform: "",
        courseTitle: "",
        nptelApplicationNumber: "",
        courseSession: "",
        courseWeeks: "",
        courseScore: "",
        courseCategory: "",
        courseCredits: "",
        registrationFeePaid: "",
        permissibleClaim: "",
        feeReceiptFile: null,
        certificateFile: null,
        photographFile: null,
        declarationAccepted: false
      });
      showSubmitPopup("success", "Your application has been submitted and sent for review.", "Application submitted");
      setApps(await api.myApplications({ limit: DASHBOARD_FETCH_LIMIT }));
    } catch (err) {
      const tooLarge = err?.status === 413 || /file too large/i.test(err?.message || "");
      showSubmitPopup(
        "error",
        tooLarge ? `File too large. Max ${MAX_FILE_LABEL} per file.` : (err.message || "Failed to submit application."),
        "Unable to submit"
      );
    } finally {
      submittingApplicationRef.current = false;
      setIsSubmittingApplication(false);
    }
  };

  const saveDepartment = async () => {
    const updated = await api.updateProfile({ department: departmentDraft });
    setUser(updated);
    setEditingDepartment(false);
  };

  const openDeleteAccountPopup = () => {
    setDeleteMessage("");
    setDeleteAccountOpen(true);
  };

  const closeDeleteAccountPopup = () => {
    if (deletingAccount) return;
    setDeleteAccountOpen(false);
  };

  const deleteAccount = async () => {
    setDeleteMessage("");
    setDeletingAccount(true);
    try {
      await api.deleteMe();
      setDeleteAccountOpen(false);
      logout(setUser);
    } catch (err) {
      setDeleteMessage(err.message || "Unable to delete account right now.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const printApplicationForm = async (app) => {
    setApplicationsNotice("");
    try {
      await exportApplicationFormPdf(app);
      setApplicationsNoticeType("success");
      setApplicationsNotice(`Application form PDF exported for ID ${app?.id || "-"}.`);
    } catch (err) {
      setApplicationsNoticeType("error");
      setApplicationsNotice(err?.message || "Failed to export application form PDF.");
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
  const facultySubmissionCountInSixMonths = apps.filter((app) => (
    app.application_type === "faculty" &&
    app.created_at &&
    new Date(app.created_at).getTime() >= sixMonthsAgoMs
  )).length;
  const facultyLimitReached = false;

  return (
    <div className="dashboard-page">
      <div className="page-container">
        <div className="mb-4 lg:hidden">
          <div>
            <div className="text-lg font-bold font-display text-[color:var(--primary-deep)]">SBJIT NPTEL Reimburse</div>
          </div>
        </div>

        <div className="dashboard-shell">
          <div className="dashboard-sidebar">
            <Sidebar items={menu} active={active} onSelect={handleSelect} user={user} />
          </div>
          <div className="dashboard-content">
          <Topbar title={`Faculty Portal`} subtitle={`Hello ${user?.name || ""}`} />
          {active !== "Application Form" && (
            <div className="dashboard-kpi-grid">
              <div className="stat-card">
                <div className="stat-card-label">Applications</div>
                <div className="stat-card-value">{apps.length}</div>
                <div className="stat-card-sub">Submitted by you</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Role</div>
                <div className="stat-card-value text-xl capitalize">{user?.role || "faculty"}</div>
                <div className="stat-card-sub">Active profile</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Department</div>
                <div className="stat-card-value text-xl">{user?.department || "-"}</div>
                <div className="stat-card-sub">Current unit</div>
              </div>
            </div>
          )}

                    {active === "Application Form" && (
            <div className="mt-8 animate-slide-up">
              <div className="section-card">
                <h2 className="text-xl font-bold font-display text-[color:var(--primary-deep)]">Faculty Application Form</h2>
                <p className="muted mt-2 text-sm">Submit the academic year incentive application with full details.</p>
                {facultyLimitReached && (
                  <div className="alert-warning mt-4">
                    You have already submitted 2 faculty applications in the last six months. You cannot submit more.
                  </div>
                )}
                <form onSubmit={submit} className="mt-6 space-y-5 pb-24 sm:mt-8 sm:space-y-6">
                  <div className="form-section">
                    <div className="form-section-header">
                      <div className="form-section-title">Applicant Details</div>
                      <div className="form-section-subtitle">Faculty profile</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Department</label>
                        <input className="input mt-2 bg-black/5" value={form.department} readOnly required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Applicant Name</label>
                        <input className="input mt-2 bg-black/5 font-semibold" value={toUpperText(form.applicantName)} readOnly required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Mobile Number</label>
                        <input className="input mt-2" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Email ID</label>
                        <input className="input mt-2 bg-black/5" type="email" value={form.email} readOnly required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Designation</label>
                        <input className="input mt-2" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Academic Year</label>
                        <input
                          className="input mt-2"
                          value={form.academicYear}
                          onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                          onBlur={(e) => setForm((prev) => ({ ...prev, academicYear: normalizeAcademicYear(e.target.value) }))}
                          required
                          placeholder="eg., 2023 - 2024"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Academic Year Type</label>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-black/70">
                          {["ODD", "EVEN"].map((yearType) => (
                            <label key={yearType} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="facultyAcademicYearType"
                                value={yearType}
                                checked={form.academicYearType === yearType}
                                onChange={(e) => setForm({ ...form, academicYearType: e.target.value })}
                              />
                              {yearType}
                            </label>
                          ))}
                        </div>
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
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Category</label>
                        <select
                          className="input mt-2"
                          value={form.courseCategory}
                          onChange={(e) => setForm({ ...form, courseCategory: e.target.value })}
                          required
                        >
                          <option value="" disabled>Select category</option>
                          {COURSE_CATEGORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {showCourseDetails && (
                    <div ref={courseSectionsRef} className="space-y-5">
                      <div className="form-section">
                        <div className="form-section-header">
                          <div className="form-section-title">Course Details</div>
                          <div className="form-section-subtitle">Certification information</div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <label className="text-xs uppercase tracking-[0.2em] text-black/40">Platform</label>
                            <input className="input mt-2" placeholder="Enter platform (e.g., NPTEL, Coursera)" value={form.coursePlatform} onChange={(e) => setForm({ ...form, coursePlatform: e.target.value })} required />
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-[0.2em] text-black/40">Title of Course</label>
                            <input className="input mt-2" placeholder="Enter course title" value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} required />
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-[0.2em] text-black/40">NPTEL Roll Number</label>

                            <input
                              className="input mt-2 uppercase"
                              value={form.nptelApplicationNumber}
                              onChange={(e) => setForm({ ...form, nptelApplicationNumber: toUpperText(e.target.value) })}
                              required
                              placeholder="e.g., NPTEL-APP-12345"
                            />
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
                            <label className="text-xs uppercase tracking-[0.2em] text-black/40">Credits</label>
                            <input className="input mt-2" type="number" min="0" value={form.courseCredits} onChange={(e) => setForm({ ...form, courseCredits: e.target.value })} required />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {showRegistrationDetails && (
                    <div className="form-section">
                      <div className="form-section-header">
                        <div className="form-section-title">Registration Details</div>
                        <div className="form-section-subtitle">Fee + claim</div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  )}

                  <div className="form-section">
                    <div className="form-section-header">
                      <div className="form-section-title">Documents Attached</div>
                      <div className="form-section-subtitle">Upload proofs</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {showCourseDetails && (
                        <div>
                          <label className="text-xs uppercase tracking-[0.2em] text-black/40">Fee Payment Receipt (Max 150KB)</label>
                          <input
                            className="input mt-2"
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(e) => setForm({ ...form, feeReceiptFile: e.target.files?.[0] || null })}
                            required
                          />
                          {form.feeReceiptFile && <div className="muted mt-1 text-xs">{form.feeReceiptFile?.name}</div>}
                        </div>
                      )}
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Certificate From Certification Authority (Max 150KB)</label>
                        <input
                          className="input mt-2"
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => setForm({ ...form, certificateFile: e.target.files?.[0] || null })}
                          required
                        />
                        {form.certificateFile && <div className="muted mt-1 text-xs">{form.certificateFile?.name}</div>}
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Photograph (JPG, Max 150KB)</label>
                        <input
                          className="input mt-2"
                          type="file"
                          accept=".jpg,.jpeg,image/jpeg"
                          onChange={(e) => setForm({ ...form, photographFile: e.target.files?.[0] || null })}
                          required
                        />
                        {form.photographFile && <div className="muted mt-1 text-xs">{form.photographFile?.name}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="form-section-header">
                      <div className="form-section-title">Declaration</div>
                      <div className="form-section-subtitle">Required to submit</div>
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
                      <button className="btn btn-primary w-full sm:w-auto" type="submit" disabled={facultyLimitReached || isSubmittingApplication}>
                        {facultyLimitReached ? "Limit Reached" : (isSubmittingApplication ? "Submitting..." : "Submit Application")}
                      </button>
                      <button
                        className="btn btn-ghost w-full sm:w-auto"
                        type="button"
                        disabled={isSubmittingApplication}
                        onClick={() => setForm({
                          department: user?.department || "",
                          applicantName: user?.name || "",
                          mobileNumber: "",
                          academicYear: "",
                          academicYearType: "ODD",
                          email: normalizeEmail(user?.email || ""),
                          designation: "",
                          incentiveClaimCount: "00",
                          coursePlatform: "",
                          courseTitle: "",
                          nptelApplicationNumber: "",
                          courseSession: "",
                          courseWeeks: "",
                          courseScore: "",
                          courseCategory: "",
                          courseCredits: "",
                          registrationFeePaid: "",
                          permissibleClaim: "",
                          feeReceiptFile: null,
                          certificateFile: null,
                          photographFile: null,
                          declarationAccepted: false
                        })}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {active === "My Applications" && (
            <div className="mt-8 animate-slide-up">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-display text-[color:var(--primary-deep)]">My Applications</h2>
                <div className="flex items-center gap-3">
                  <button className="btn btn-ghost" type="button" onClick={refreshData}>Refresh</button>
                  <div className="muted text-sm">{apps.length} total</div>
                </div>
              </div>
              {applicationsNotice && (
                <div className={`mt-3 text-sm ${applicationsNoticeType === "error" ? "text-rose-600" : "text-emerald-600"}`}>
                  {applicationsNotice}
                </div>
              )}
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
                            className={`flow-step ${
                              isRejected
                                ? "flow-step-rejected"
                                : reached
                                  ? "flow-step-done"
                                  : "flow-step-pending"
                            }`}
                          >
                            {step.label}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-black/70 md:grid-cols-2">
                      {[
                        ["Department", app.data.department],
                        ["Designation", app.data.designation],
                        ["Email", app.data.email],
                        ["Mobile", app.data.mobile_number],
                        ["Academic Year", formatAcademicYear(app.data.academic_year, "")],
                        ["Academic Year Type", app.data.academic_year_type],
                        ["Course", app.data.course_title],
                        ["Category", app.data.course_category],
                        ["NPTEL Application No", app.data.nptel_application_number],
                        ["Platform", app.data.course_platform],
                        ["Score", app.data.course_score],
                        ["Credits", app.data.course_credits],
                        ["Fee Paid", app.data.registration_fee_paid],
                        ["Permissible Claim", app.data.permissible_claim],
                        ["Approved Amount", getApprovedAmount(app)]
                      ]
                        .filter(([, value]) => hasDisplayText(value))
                        .map(([label, value]) => (
                          <div key={label}>
                            <span className="text-black/50">{label}:</span> {value}
                          </div>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      {app.status === "approved" && (
                        <button className="btn btn-primary" type="button" onClick={() => setSelectedApplication(app)}>
                          Application Details
                        </button>
                      )}
                      <button className="btn btn-ghost" type="button" onClick={() => printApplicationForm(app)}>
                        Print Form PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "Feedback" && (
            <div className="mt-8 animate-slide-up">
              <h2 className="text-xl font-bold font-display text-[color:var(--primary-deep)]">Feedback</h2>
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
            <div className="mt-8 animate-slide-up">
              <h2 className="text-xl font-bold font-display text-[color:var(--primary-deep)]">Profile</h2>
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
            <div className="mt-8 animate-slide-up">
              <h2 className="text-xl font-bold font-display text-rose-600">Delete Account</h2>
              <p className="mt-2 text-sm text-black/70">
                This deactivates your account access. Your records are retained in the database.
              </p>
              <div className="mt-4 section-card border-rose-200 bg-rose-50/50">
                <button
                  className="btn btn-danger disabled:opacity-60"
                  type="button"
                  onClick={openDeleteAccountPopup}
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

      <SubmitStatusPopup
        open={submitPopup.open}
        type={submitPopup.type}
        title={submitPopup.title}
        message={submitPopup.message}
        onClose={closeSubmitPopup}
        onViewApplications={submitPopup.type === "success" ? viewApplicationsFromPopup : undefined}
      />

      <ApplicationDetailsPopup
        open={Boolean(selectedApplication)}
        application={selectedApplication}
        onClose={() => setSelectedApplication(null)}
      />

      <DangerConfirmPopup
        open={deleteAccountOpen}
        title="Delete your account?"
        message="This will deactivate your account access. Your submitted records will remain stored and can be restored by the administrator."
        note="Please pause for a moment and make sure this is the action you want."
        confirmLabel="Delete My Account"
        loadingLabel="Deleting..."
        loading={deletingAccount}
        errorMessage={deleteMessage}
        onClose={closeDeleteAccountPopup}
        onConfirm={deleteAccount}
      />

      <DashboardMobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={menu}
        active={active}
        onSelect={handleSelect}
        user={user}
      />
    </div>
  );
}





