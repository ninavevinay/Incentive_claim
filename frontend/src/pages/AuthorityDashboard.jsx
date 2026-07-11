import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import DashboardMobileSidebar from "../components/DashboardMobileSidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import ApplicationDetailsPopup from "../components/ApplicationDetailsPopup.jsx";
import SubmitStatusPopup from "../components/SubmitStatusPopup.jsx";
import DangerConfirmPopup from "../components/DangerConfirmPopup.jsx";
import { api, resolveMediaUrl } from "../lib/api.js";
import { useAuth, logout } from "../lib/auth.jsx";
import { getApprovedAmount, getApprovedAmountByRole, getInstitutionCoordinatorApprovedAmount } from "../lib/amount.js";
import { formatAcademicYear, isAcademicYearFormat, normalizeAcademicYear } from "../lib/academicYear.js";
import { exportApplicationFormPdf } from "../lib/applicationFormPdf.js";
import { drawPdfHeader, getPdfHeaderImageDataUrl } from "../lib/pdfHeader.js";
import { DashboardSkeleton } from "../components/Skeleton.jsx";
import { getStoredMenuSelection, setStoredMenuSelection } from "../lib/dashboardStorage.js";
import {
  COURSE_CATEGORY_OPTIONS,
  normalizeCourseCategory,
  shouldShowCourseDetails,
  shouldShowRegistrationDetails
} from "../lib/courseCategories.js";

const baseMenu = [
  "Overview",
  "Application Form",
  "My Applications",
  "Pending Applications",
  "My Approved Applications",
  "Total Applications",
  "Feedback",
  "Profile",
  "Delete Account",
  "Logout"
];
const AUTO_REFRESH_MS = 30000;
const AUTHORITY_FETCH_LIMIT = 250;
const FEEDBACK_FETCH_LIMIT = 200;
const REPORT_FEEDBACK_FETCH_LIMIT = 500;
const MAX_FILE_BYTES = 150 * 1024;
const MAX_FILE_LABEL = "150KB";
const INCENTIVE_CLAIM_OPTIONS = Array.from({ length: 8 }, (_, index) => String(index));
const DEFAULT_INCENTIVE_CLAIM_COUNT = "0";
const getAuthorityTabStorageKey = (role) => `incentive:authority:${role || "unknown"}:active-tab`;

const ROLE_LABELS = {
  department_coordinator: "Department Coordinator",
  department_hod: "Department HOD",
  institution_coordinator: "Institution Coordinator"
};
const AUTHORITY_ROLES = [
  { value: "department_coordinator", label: "Department Coordinator" },
  { value: "department_hod", label: "Department HOD" },
  { value: "institution_coordinator", label: "Institution Coordinator" }
];
const AUTHORITY_ROLE_LABELS = Object.fromEntries(
  AUTHORITY_ROLES.map((item) => [item.value, item.label])
);
const REPORT_STATUS_META = [
  { key: "pending_department_coordinator", label: "Pending Dept Coordinator", color: "#0ea5e9" },
  { key: "pending_department_hod", label: "Pending Dept HOD", color: "#6366f1" },
  { key: "pending_institution_coordinator", label: "Pending Institution Coordinator", color: "#f59e0b" },
  { key: "approved", label: "Approved", color: "#10b981" },
  { key: "rejected", label: "Rejected", color: "#ef4444" }
];
const REPORT_CHART_TYPES = [
  { value: "pie", label: "Pie Chart" },
  { value: "bar", label: "Bar Chart" }
];
const REPORT_GRAPH_OPTIONS = [
  { value: "all_applications", label: "All Applications" },
  { value: "academic_year", label: "Academic Year + Type" },
  { value: "topper", label: "Topper" },
  { value: "department_wise", label: "Department Wise" },
  { value: "application_type", label: "Faculty / Student" },
  { value: "category_wise", label: "Category Wise" },
  { value: "feedback", label: "Feedback" },
  { value: "last_year", label: "Last Year" },
  { value: "monthly_trend", label: "Yearly Trend" },
  { value: "all_graphs", label: "All Graphs" }
];
const REPORT_GRAPH_SEQUENCE = [
  "all_applications",
  "academic_year",
  "topper",
  "department_wise",
  "application_type",
  "category_wise",
  "feedback",
  "last_year",
  "monthly_trend"
];
const REPORT_EXTRA_COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#8b5cf6",
  "#84cc16",
  "#e11d48",
  "#3b82f6"
];
const REPORT_YEAR_WISE_START = 2024;
const AUTHORITY_UI_PAGE_SIZE = 8;

const toReportLabel = (value, fallback = "Not Provided") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toAcademicYearType = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ODD") return "ODD";
  if (normalized === "EVEN") return "EVEN";
  return "Not Provided";
};

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

const normalizeSearchText = (value) => String(value ?? "").trim().toLowerCase();

const buildApplicationSearchText = (app) => {
  const data = app?.data || {};
  return [
    app?.id,
    app?.application_type,
    app?.status,
    data?.applicant_name,
    data?.application_name,
    data?.department,
    data?.usn,
    data?.email,
    data?.mobile_number,
    data?.designation,
    data?.semester,
    data?.academic_year,
    data?.academic_year_type,
    data?.incentive_claim_count,
    data?.course_platform,
    data?.course_title,
    data?.nptel_application_number,
    data?.course_session,
    data?.course_weeks,
    data?.course_score,
    data?.course_category,
    data?.course_credits
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(" ");
};

const matchesApplicationSearch = (app, search) => {
  const query = normalizeSearchText(search);
  if (!query) return true;
  return buildApplicationSearchText(app).includes(query);
};

const isDisplayValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  return text !== "-" && lowered !== "not provided" && lowered !== "n/a";
};

const hasDisplayText = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  return text !== "-" && lowered !== "not provided" && lowered !== "n/a";
};

const toAcademicYearAndTypeLabel = (academicYearValue, academicYearTypeValue) => {
  const yearLabel = formatAcademicYear(academicYearValue, "Not Provided");
  const yearTypeLabel = toAcademicYearType(academicYearTypeValue);
  if (yearTypeLabel === "Not Provided") return yearLabel;
  return `${yearLabel} (${yearTypeLabel})`;
};

const parseReportYearStart = (value) => {
  const match = String(value ?? "").match(/\b(20\d{2})\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFeedbackRatingLabel = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return "Not Rated";
  const rounded = Math.min(5, Math.max(1, Math.round(numeric)));
  return `${rounded} Star`;
};

const groupReportData = (items, getLabel, fallback = "Not Provided", maxSlices = 6) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = toReportLabel(getLabel(item), fallback);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const sorted = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  if (sorted.length <= maxSlices) return sorted;
  const top = sorted.slice(0, Math.max(maxSlices - 1, 1));
  const others = sorted.slice(top.length).reduce((sum, item) => sum + item.count, 0);
  return [...top, { label: "Others", count: others }];
};

const withChartColors = (items) =>
  items.map((item, index) => ({
    ...item,
    color: REPORT_EXTRA_COLORS[index % REPORT_EXTRA_COLORS.length]
  }));

const buildPieSegments = (items, total, radius = 72) => {
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return items
    .filter((item) => item.count > 0)
    .map((item) => {
      const length = total > 0 ? (item.count / total) * circumference : 0;
      const segment = { ...item, radius, circumference, length, offset };
      offset += length;
      return segment;
    });
};

const clampPage = (page, totalPages) => {
  const safeTotal = Math.max(1, totalPages || 1);
  return Math.min(Math.max(1, page), safeTotal);
};

const paginateRows = (rows, page, pageSize = AUTHORITY_UI_PAGE_SIZE) => {
  const list = Array.isArray(rows) ? rows : [];
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = clampPage(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    rows: list.slice(start, start + pageSize),
    currentPage,
    totalPages,
  };
};

export default function AuthorityDashboard() {
  const { user, setUser } = useAuth();
  const [active, setActive] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apps, setApps] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [myApprovedApps, setMyApprovedApps] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [reportFeedbackList, setReportFeedbackList] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({ benefit_status: "beneficial", rating: "5", message: "" });
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [notices, setNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeFile, setNoticeFile] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [authorityUsers, setAuthorityUsers] = useState([]);
  const [authorityFilter, setAuthorityFilter] = useState("");
  const [authorityUsersMessage, setAuthorityUsersMessage] = useState({ type: "", text: "" });
  const [updatingAuthorityUserId, setUpdatingAuthorityUserId] = useState(null);
  const [authorityUsersPage, setAuthorityUsersPage] = useState(1);
  const [formWindowForm, setFormWindowForm] = useState({ start_date: "", end_date: "" });
  const [formWindowMessage, setFormWindowMessage] = useState("");
  const [message, setMessage] = useState("");
  const [editingDepartment, setEditingDepartment] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [mySubmittedApps, setMySubmittedApps] = useState([]);
  const [applicationsNotice, setApplicationsNotice] = useState("");
  const [applicationsNoticeType, setApplicationsNoticeType] = useState("success");
  const [submitPopup, setSubmitPopup] = useState({
    open: false,
    type: "success",
    title: "",
    message: ""
  });
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState({});
  const [approveAmounts, setApproveAmounts] = useState({});
  const [reportChartType, setReportChartType] = useState("pie");
  const [reportYearFilter, setReportYearFilter] = useState("all");
  const [reportApprovedYearFilter, setReportApprovedYearFilter] = useState("all");
  const [reportApprovedYearTypeFilter, setReportApprovedYearTypeFilter] = useState("all");
  const [reportApprovedDepartmentFilter, setReportApprovedDepartmentFilter] = useState("all");
  const [reportStudentSearch, setReportStudentSearch] = useState("");
  const [reportStudentYearFilter, setReportStudentYearFilter] = useState("all");
  const [reportStudentCategoryFilter, setReportStudentCategoryFilter] = useState("all");
  const [pendingSearch, setPendingSearch] = useState("");
  const [approvedSearch, setApprovedSearch] = useState("");
  const [myApplicationsSearch, setMyApplicationsSearch] = useState("");
  const [totalSearch, setTotalSearch] = useState("");
  const [totalStatusFilter, setTotalStatusFilter] = useState("all");
  const [reportNotice, setReportNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [isTabRestored, setIsTabRestored] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [myApplicationsPage, setMyApplicationsPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [totalPage, setTotalPage] = useState(1);
  const [form, setForm] = useState({
    department: "",
    applicantName: "",
    mobileNumber: "",
    academicYear: "",
    academicYearType: "ODD",
    email: "",
    designation: "",
    incentiveClaimCount: DEFAULT_INCENTIVE_CLAIM_COUNT,
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
  const submittingApplicationRef = useRef(false);
  const courseSectionsRef = useRef(null);
  const previousCourseCategoryRef = useRef(form.courseCategory);
  const graphContainerRef = useRef(null);
  const allGraphsPdfRef = useRef(null);
  const menu = user?.role === "institution_coordinator"
    ? [...baseMenu.slice(0, 4), "Approved Students", ...baseMenu.slice(4, 6), "Reports", "Notice", "Authority Users", "Form Filling Window", ...baseMenu.slice(6)]
    : baseMenu;

  useEffect(() => {
    if (!user) {
      setIsTabRestored(false);
      return;
    }
    const storedTab = getStoredMenuSelection(getAuthorityTabStorageKey(user.role), "Overview", menu);
    setActive(storedTab);
    setIsTabRestored(true);
  }, [user?.role]);

  const scopedDepartment = user?.role === "institution_coordinator" ? "" : (user?.department || "");
  const fetchPending = async () =>
    api.pendingApplications({ department: scopedDepartment, limit: AUTHORITY_FETCH_LIMIT });
  const fetchAll = async () =>
    api.allApplications({ department: scopedDepartment, limit: AUTHORITY_FETCH_LIMIT });
  const loadAuthorityUsers = async (search = "") => {
    if (user?.role !== "institution_coordinator") {
      setAuthorityUsers([]);
      return [];
    }
    const rows = await api.coordinatorAuthorityUsers({
      include_inactive: true,
      limit: AUTHORITY_FETCH_LIMIT,
      q: search || undefined
    }).catch(() => []);
    const normalizedRows = Array.isArray(rows) ? rows : [];
    setAuthorityUsers(normalizedRows);
    return normalizedRows;
  };
  const loadMyApplications = async () => {
    const rows = await api.myApplications({ limit: AUTHORITY_FETCH_LIMIT }).catch(() => []);
    const normalizedRows = Array.isArray(rows) ? rows : [];
    setMySubmittedApps(normalizedRows);
    return normalizedRows;
  };
  const loadFormWindowData = async () => {
    if (user?.role !== "institution_coordinator") {
      setFormWindowForm({ start_date: "", end_date: "" });
      return { start_date: null, end_date: null };
    }
    const formWindowData = await api.adminFormWindow().catch(() => ({ start_date: null, end_date: null }));
    setFormWindowForm({
      start_date: formWindowData?.start_date || "",
      end_date: formWindowData?.end_date || ""
    });
    return formWindowData;
  };
  const loadReportFeedback = async () => {
    if (user?.role !== "institution_coordinator") {
      setReportFeedbackList([]);
      return [];
    }
    const reportRows = await api.feedbackReport({ limit: REPORT_FEEDBACK_FETCH_LIMIT }).catch(() => []);
    setReportFeedbackList(Array.isArray(reportRows) ? reportRows : []);
    return reportRows;
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchPending().then(setApps).catch(() => setApps([])),
      fetchAll().then(setAllApps).catch(() => setAllApps([])),
      loadMyApplications(),
      api.myReviewedApplications("approve", { limit: AUTHORITY_FETCH_LIMIT })
        .then(setMyApprovedApps)
        .catch(() => setMyApprovedApps([])),
      api.myFeedback({ limit: FEEDBACK_FETCH_LIMIT }).then(setFeedbackList).catch(() => setFeedbackList([])),
      loadReportFeedback(),
      api.publicNotices().then(setNotices).catch(() => setNotices([])),
      user?.role === "institution_coordinator" ? loadAuthorityUsers() : Promise.resolve([]),
      user?.role === "institution_coordinator" ? loadFormWindowData() : Promise.resolve({ start_date: null, end_date: null })
    ]).finally(() => setLoading(false));
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchPending().then(setApps).catch(() => setApps([]));
      fetchAll().then(setAllApps).catch(() => setAllApps([]));
      loadMyApplications();
      api.publicNotices().then(setNotices).catch(() => setNotices([]));
      if (active === "My Approved Applications") {
        api.myReviewedApplications("approve", { limit: AUTHORITY_FETCH_LIMIT })
          .then(setMyApprovedApps)
          .catch(() => setMyApprovedApps([]));
      }
      if (active === "Feedback") {
        api.myFeedback({ limit: FEEDBACK_FETCH_LIMIT }).then(setFeedbackList).catch(() => setFeedbackList([]));
      }
      if (active === "Overview" || active === "Reports") {
        loadReportFeedback();
      }
      if (active === "Authority Users" && user?.role === "institution_coordinator") {
        loadAuthorityUsers(authorityFilter.trim());
      }
      if (active === "Form Filling Window" && user?.role === "institution_coordinator") {
        loadFormWindowData();
      }
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [user, active]);

  useEffect(() => {
    if (!user) return;
    const refreshOnFocus = () => {
      fetchPending().then(setApps).catch(() => setApps([]));
      fetchAll().then(setAllApps).catch(() => setAllApps([]));
      loadMyApplications();
      api.publicNotices().then(setNotices).catch(() => setNotices([]));
      if (active === "My Approved Applications") {
        api.myReviewedApplications("approve", { limit: AUTHORITY_FETCH_LIMIT })
          .then(setMyApprovedApps)
          .catch(() => setMyApprovedApps([]));
      }
      if (active === "Overview" || active === "Reports") {
        loadReportFeedback();
      }
      if (active === "Authority Users" && user?.role === "institution_coordinator") {
        loadAuthorityUsers(authorityFilter.trim());
      }
      if (active === "Form Filling Window" && user?.role === "institution_coordinator") {
        loadFormWindowData();
      }
      if (active === "Feedback") {
        api.myFeedback({ limit: FEEDBACK_FETCH_LIMIT }).then(setFeedbackList).catch(() => setFeedbackList([]));
      }
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
  }, [user?.id, user?.role, user?.department, active]);

  useEffect(() => {
    setDepartmentDraft(user?.department || "");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      department: prev.department || user.department || "",
      applicantName: toUpperText(prev.applicantName || user.name || ""),
      email: prev.email || normalizeEmail(user.email || "")
    }));
  }, [user]);

  const refresh = async () => {
    setLoading(true);
    setApps(await fetchPending().catch(() => []));
    setAllApps(await fetchAll().catch(() => []));
    await loadMyApplications();
    setMyApprovedApps(
      await api.myReviewedApplications("approve", { limit: AUTHORITY_FETCH_LIMIT }).catch(() => [])
    );
    await loadReportFeedback();
    if (user?.role === "institution_coordinator") {
      await loadAuthorityUsers(authorityFilter.trim());
      await loadFormWindowData();
    }
    setNotices(await api.publicNotices().catch(() => []));
    setLoading(false);
  };

  const loadFeedback = async () => {
    const mine = await api.myFeedback({ limit: FEEDBACK_FETCH_LIMIT }).catch(() => []);
    setFeedbackList(mine);
  };

  const refreshApprovedOnly = async () => {
    setMyApprovedApps(
      await api.myReviewedApplications("approve", { limit: AUTHORITY_FETCH_LIMIT }).catch(() => [])
    );
  };

  const toUpperText = (value) => String(value || "").toUpperCase();
  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const showCourseDetails = shouldShowCourseDetails(form.courseCategory);
  const showRegistrationDetails = shouldShowRegistrationDetails(form.courseCategory);
  const closeSubmitPopup = () => setSubmitPopup((prev) => ({ ...prev, open: false }));
  const showSubmitPopup = (type, popupMessage, title = "") => {
    setSubmitPopup({
      open: true,
      type,
      title,
      message: popupMessage
    });
  };
  const viewApplicationsFromPopup = () => {
    closeSubmitPopup();
    setActive("My Applications");
  };

  useEffect(() => {
    const previousCategory = previousCourseCategoryRef.current;
    previousCourseCategoryRef.current = form.courseCategory;
    if (!showCourseDetails || previousCategory === form.courseCategory) return;
    courseSectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [form.courseCategory, showCourseDetails]);

  const submitApplication = async (e) => {
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
        incentiveClaimCount: DEFAULT_INCENTIVE_CLAIM_COUNT,
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
      await loadMyApplications();
      showSubmitPopup("success", "Your application has been submitted and sent for review.", "Application submitted");
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

  useEffect(() => {
    if (!menu.includes(active)) {
      setActive("Overview");
    }
  }, [user?.role, active]);

  useEffect(() => {
    if (!user || !isTabRestored) return;
    if (!menu.includes(active)) return;
    setStoredMenuSelection(getAuthorityTabStorageKey(user.role), active);
  }, [active, user?.role, isTabRestored]);

  useEffect(() => {
    if (active === "My Approved Applications") {
      refreshApprovedOnly();
    }
    if (active === "My Applications" || active === "Application Form") {
      loadMyApplications();
    }
    if (active === "Feedback") {
      loadFeedback();
    }
    if (active === "Authority Users" && user?.role === "institution_coordinator") {
      loadAuthorityUsers(authorityFilter.trim());
    }
    if (active === "Form Filling Window" && user?.role === "institution_coordinator") {
      loadFormWindowData();
    }
  }, [active, user?.role, authorityFilter]);

  useEffect(() => {
    const handleToggle = () => setSidebarOpen((prev) => !prev);
    window.addEventListener("portal:toggle-dashboard-menu", handleToggle);
    return () => window.removeEventListener("portal:toggle-dashboard-menu", handleToggle);
  }, []);

  const normalize = (value) => (value || "").trim().toLowerCase();
  const scopedAllApps = user?.role === "institution_coordinator"
    ? allApps
    : allApps.filter((app) => normalize(app.data?.department) === normalize(user?.department));
  const filteredPendingApps = apps.filter((app) => matchesApplicationSearch(app, pendingSearch));

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
  const getMyLatestReview = (app) => {
    const reviews = Array.isArray(app?.data?.reviews) ? app.data.reviews : [];
    const currentUserId = String(user?.id || "");
    const currentRole = String(user?.role || "");
    return (
      [...reviews].reverse().find((review) => {
        if (review?.reviewer_id !== undefined && review?.reviewer_id !== null) {
          return currentUserId && String(review.reviewer_id) === currentUserId;
        }
        return review?.role === currentRole;
      }) || null
    );
  };
  const localReviewedByMeApps = scopedAllApps.filter((app) => Boolean(getMyLatestReview(app)));

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
  const approvedByMeYearOptions = Array.from(
    new Set(approvedByMeApps.map((app) => formatAcademicYear(app?.data?.academic_year, "Not Provided")))
  ).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));
  const approvedByMeYearTypeOptions = Array.from(
    new Set(approvedByMeApps.map((app) => toAcademicYearType(app?.data?.academic_year_type)))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const approvedByMeDepartmentOptions = Array.from(
    new Set(approvedByMeApps.map((app) => toReportLabel(app?.data?.department, "Not Provided")))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const filteredApprovedByMeApps = approvedByMeApps.filter((app) => {
    const appYear = formatAcademicYear(app?.data?.academic_year, "Not Provided");
    const appYearType = toAcademicYearType(app?.data?.academic_year_type);
    const appDepartment = toReportLabel(app?.data?.department, "Not Provided");
    const searchPass = matchesApplicationSearch(app, approvedSearch);
    const yearPass = reportApprovedYearFilter === "all" || appYear === reportApprovedYearFilter;
    const yearTypePass = reportApprovedYearTypeFilter === "all" || appYearType === reportApprovedYearTypeFilter;
    const departmentPass = reportApprovedDepartmentFilter === "all" || appDepartment === reportApprovedDepartmentFilter;
    return searchPass && yearPass && yearTypePass && departmentPass;
  });
  const filteredMySubmittedApps = mySubmittedApps.filter((app) => matchesApplicationSearch(app, myApplicationsSearch));
  const filteredTotalApps = scopedAllApps.filter((app) => {
    const searchPass = matchesApplicationSearch(app, totalSearch);
    const statusPass = totalStatusFilter === "all" || String(app?.status || "").toLowerCase() === totalStatusFilter;
    return searchPass && statusPass;
  });
  const filteredAuthorityUsers = authorityUsers.filter((u) => {
    const value = `${u.name} ${u.email} ${u.department} ${AUTHORITY_ROLE_LABELS[u.role] || u.role}`.toLowerCase();
    return value.includes(authorityFilter.trim().toLowerCase());
  });
  const activeAuthorityUsersCount = authorityUsers.filter((u) => u?.is_active !== false).length;
  const inactiveAuthorityUsersCount = authorityUsers.length - activeAuthorityUsersCount;
  const pendingPageData = paginateRows(filteredPendingApps, pendingPage);
  const myApplicationsPageData = paginateRows(filteredMySubmittedApps, myApplicationsPage);
  const approvedPageData = paginateRows(filteredApprovedByMeApps, approvedPage);
  const totalPageData = paginateRows(filteredTotalApps, totalPage);
  const authorityUsersPageData = paginateRows(filteredAuthorityUsers, authorityUsersPage);

  useEffect(() => {
    setPendingPage((prev) =>
      clampPage(prev, Math.ceil(Math.max(filteredPendingApps.length, 1) / AUTHORITY_UI_PAGE_SIZE))
    );
  }, [filteredPendingApps.length]);

  useEffect(() => {
    setMyApplicationsPage((prev) =>
      clampPage(prev, Math.ceil(Math.max(filteredMySubmittedApps.length, 1) / AUTHORITY_UI_PAGE_SIZE))
    );
  }, [filteredMySubmittedApps.length]);

  useEffect(() => {
    setApprovedPage((prev) =>
      clampPage(prev, Math.ceil(Math.max(filteredApprovedByMeApps.length, 1) / AUTHORITY_UI_PAGE_SIZE))
    );
  }, [filteredApprovedByMeApps.length]);

  useEffect(() => {
    setTotalPage((prev) => clampPage(prev, Math.ceil(Math.max(filteredTotalApps.length, 1) / AUTHORITY_UI_PAGE_SIZE)));
  }, [filteredTotalApps.length]);

  useEffect(() => {
    setAuthorityUsersPage((prev) =>
      clampPage(prev, Math.ceil(Math.max(filteredAuthorityUsers.length, 1) / AUTHORITY_UI_PAGE_SIZE))
    );
  }, [filteredAuthorityUsers.length]);

  const rejectedAppsCount = scopedAllApps.filter((app) => app.status === "rejected").length;
  const reportBreakdown = REPORT_STATUS_META.map((statusMeta) => ({
    ...statusMeta,
    count: scopedAllApps.filter((app) => app.status === statusMeta.key).length
  }));
  const reportTotalCount = reportBreakdown.reduce((sum, item) => sum + item.count, 0);
  const reportPendingCount = reportBreakdown
    .filter((item) => item.key.startsWith("pending_"))
    .reduce((sum, item) => sum + item.count, 0);
  const reportApprovedApps = scopedAllApps.filter((app) => app.status === "approved");
  const reportApprovedTotalAmount = reportApprovedApps.reduce((sum, app) => {
    const amount = Number(getInstitutionCoordinatorApprovedAmount(app));
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const reportRows = scopedAllApps.map((app) => {
    const data = app.data || {};
    const amount = Number(getInstitutionCoordinatorApprovedAmount(app));
    const statusMeta = REPORT_STATUS_META.find((item) => item.key === app.status);
    return {
      id: app.id,
      applicant: data.applicant_name || data.application_name || "-",
      type: app.application_type || "-",
      department: data.department || "-",
      academicYear: formatAcademicYear(data.academic_year, "Not Provided"),
      courseCategory: toReportLabel(data.course_category, "Not Provided"),
      mobile: data.mobile_number || "-",
      email: data.email || "-",
      status: statusMeta?.label || app.status || "-",
      approvedAmount: Number.isFinite(amount) ? amount : 0,
      createdAt: app.created_at ? new Date(app.created_at).toLocaleString() : "-"
    };
  });
  const reportDateTag = new Date().toISOString().slice(0, 10);
  const formatRs = (value) => Number(value || 0).toFixed(2);
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const yearWiseSummaryMap = new Map();
  scopedAllApps.forEach((app) => {
    const year = formatAcademicYear(app?.data?.academic_year, "Not Provided");
    if (!yearWiseSummaryMap.has(year)) {
      yearWiseSummaryMap.set(year, {
        year,
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        approvedAmount: 0
      });
    }
    const row = yearWiseSummaryMap.get(year);
    row.total += 1;
    if (app.status === "approved") {
      row.approved += 1;
      const approvedAmount = Number(getInstitutionCoordinatorApprovedAmount(app));
      row.approvedAmount += Number.isFinite(approvedAmount) ? approvedAmount : 0;
    } else if (app.status === "rejected") {
      row.rejected += 1;
    } else if (String(app.status || "").startsWith("pending_")) {
      row.pending += 1;
    }
  });
  const yearWiseSummary = Array.from(yearWiseSummaryMap.values()).sort((a, b) =>
    b.year.localeCompare(a.year, undefined, { numeric: true, sensitivity: "base" })
  );
  const yearWiseSummaryFromStart = yearWiseSummary
    .filter((item) => {
      const startYear = parseReportYearStart(item.year);
      return startYear !== null && startYear >= REPORT_YEAR_WISE_START;
    })
    .sort((a, b) => {
      const aYear = parseReportYearStart(a.year) || 0;
      const bYear = parseReportYearStart(b.year) || 0;
      return aYear - bYear;
    });
  const yearWiseDropdownOptions = yearWiseSummaryFromStart.length > 0 ? yearWiseSummaryFromStart : yearWiseSummary;
  const selectedYearLabel = reportYearFilter === "all" ? "All Academic Years" : reportYearFilter;
  const yearFilteredApps = reportYearFilter === "all"
    ? scopedAllApps
    : scopedAllApps.filter((app) => formatAcademicYear(app?.data?.academic_year, "Not Provided") === reportYearFilter);
  const selectedYearStatusData = REPORT_STATUS_META.map((statusMeta) => ({
    label: statusMeta.label,
    color: statusMeta.color,
    count: yearFilteredApps.filter((app) => app.status === statusMeta.key).length
  }));
  const selectedYearStatusTotal = selectedYearStatusData.reduce((sum, item) => sum + item.count, 0);
  const selectedYearStatusSegments = buildPieSegments(selectedYearStatusData, selectedYearStatusTotal);
  const studentReportRows = scopedAllApps
    .filter(
      (app) => (String(app?.application_type || "").toLowerCase() === "student" || String(app?.application_type || "").toLowerCase() === "faculty") && app?.status === "approved"
    )
    .map((app) => {
      const data = app.data || {};
      const amount = Number(getInstitutionCoordinatorApprovedAmount(app));
      const statusMeta = REPORT_STATUS_META.find((item) => item.key === app.status);
      return {
        id: app.id,
        applicant: data.applicant_name || data.application_name || "-",
        type: String(app?.application_type || "").toLowerCase() === "faculty" ? "Faculty" : "Student",
        department: data.department || "-",
        academicYear: formatAcademicYear(data.academic_year, "Not Provided"),
        courseCategory: toReportLabel(data.course_category, "Not Provided"),
        nptelApplicationNumber: toReportLabel(data.nptel_application_number, "Not Provided"),
        score: toReportLabel(data.course_score, "Not Provided"),
        status: statusMeta?.label || app.status || "-",
        approvedAmount: Number.isFinite(amount) ? amount : 0,
        createdAt: app.created_at ? new Date(app.created_at).toLocaleString() : "-"
      };
    });
  const studentYearOptions = Array.from(new Set(studentReportRows.map((row) => row.academicYear)))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));
  const studentCategoryOptions = Array.from(new Set(studentReportRows.map((row) => row.courseCategory)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const filteredStudentRows = studentReportRows.filter((row) => {
    const search = reportStudentSearch.trim().toLowerCase();
    const namePass = !search || row.applicant.toLowerCase().includes(search);
    const yearPass = reportStudentYearFilter === "all" || row.academicYear === reportStudentYearFilter;
    const categoryPass = reportStudentCategoryFilter === "all" || row.courseCategory === reportStudentCategoryFilter;
    return namePass && yearPass && categoryPass;
  });
  const filteredStudentApprovedAmount = filteredStudentRows.reduce((sum, row) => sum + Number(row.approvedAmount || 0), 0);
  const yearWiseLineData = yearWiseSummaryFromStart.map((item) => ({
    key: item.year,
    label: item.year,
    count: item.total
  }));
  const yearWiseLineMax = Math.max(1, ...yearWiseLineData.map((item) => item.count));
  const yearWiseSvg = { width: 860, height: 250, paddingX: 48, paddingTop: 24, paddingBottom: 44 };
  const yearWisePlotWidth = yearWiseSvg.width - (yearWiseSvg.paddingX * 2);
  const yearWisePlotHeight = yearWiseSvg.height - yearWiseSvg.paddingTop - yearWiseSvg.paddingBottom;
  const yearWiseLineTicks = Array.from(
    new Set([
      yearWiseLineMax,
      Math.round(yearWiseLineMax * 0.75),
      Math.round(yearWiseLineMax * 0.5),
      Math.round(yearWiseLineMax * 0.25),
      0
    ])
  ).sort((a, b) => b - a);
  const yearWiseLinePoints = yearWiseLineData.map((item, index) => {
    const x = yearWiseSvg.paddingX + (
      (yearWiseLineData.length > 1 ? index / (yearWiseLineData.length - 1) : 0) * yearWisePlotWidth
    );
    const y = yearWiseSvg.paddingTop + ((1 - (item.count / yearWiseLineMax)) * yearWisePlotHeight);
    return { ...item, x, y };
  });
  const yearWiseLinePath = yearWiseLinePoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const reportGraphExportItems = [
    { key: "all_applications", title: "All Applications Status Graph" },
    { key: "academic_year", title: "Academic Year and Academic Year Type Wise Graph" },
    { key: "topper", title: "Topper Category Wise Graph" },
    { key: "department_wise", title: "Department Wise Applications Graph" },
    { key: "application_type", title: "Faculty vs Student Applications Graph" },
    { key: "category_wise", title: "Category Wise Graph" },
    { key: "feedback", title: "Feedback Rating Graph" },
    { key: "last_year", title: `Last Year (${lastYear}) Graph` },
    { key: "monthly_trend", title: "Yearly Application Trend (Line Graph)" }
  ];
  const reportLastYearApps = scopedAllApps.filter((app) => {
    if (!app?.created_at) return false;
    const year = new Date(app.created_at).getFullYear();
    return year === lastYear;
  });

  const academicYearData = withChartColors(
    groupReportData(
      scopedAllApps,
      (app) => toAcademicYearAndTypeLabel(app?.data?.academic_year, app?.data?.academic_year_type),
      "Not Provided",
      6
    )
  );
  const departmentWiseData = withChartColors(
    groupReportData(scopedAllApps, (app) => app?.data?.department, "Not Provided", 6)
  );
  const applicationTypeData = withChartColors(
    groupReportData(
      scopedAllApps,
      (app) => {
        const type = String(app?.application_type || "").trim().toLowerCase();
        if (type === "student") return "Student";
        if (type === "faculty") return "Faculty";
        return "Other";
      },
      "Other",
      6
    )
  );
  const categoryWiseData = withChartColors(
    groupReportData(scopedAllApps, (app) => app?.data?.course_category, "Not Provided", 6)
  );
  const topperApps = scopedAllApps.filter((app) => /TOP/i.test(String(app?.data?.course_category || "")));
  const topperData = withChartColors(
    groupReportData(topperApps, (app) => app?.data?.course_category, "Not Provided", 6)
  );
  const feedbackRatings = [5, 4, 3, 2, 1].map((ratingValue) => ({
    label: toFeedbackRatingLabel(ratingValue),
    count: reportFeedbackList.filter((item) => Number(item?.rating) === ratingValue).length
  }));
  const feedbackNotRatedCount = reportFeedbackList.filter((item) => {
    const numeric = Number(item?.rating);
    return !Number.isFinite(numeric) || numeric < 1;
  }).length;
  const feedbackData = withChartColors([
    ...feedbackRatings,
    ...(feedbackNotRatedCount > 0 ? [{ label: "Not Rated", count: feedbackNotRatedCount }] : [])
  ]);
  const lastYearStatusData = REPORT_STATUS_META.map((statusMeta) => ({
    label: statusMeta.label,
    color: statusMeta.color,
    count: reportLastYearApps.filter((app) => app.status === statusMeta.key).length
  }));
  const academicYearTotal = academicYearData.reduce((sum, item) => sum + item.count, 0);
  const departmentWiseTotal = departmentWiseData.reduce((sum, item) => sum + item.count, 0);
  const applicationTypeTotal = applicationTypeData.reduce((sum, item) => sum + item.count, 0);
  const categoryWiseTotal = categoryWiseData.reduce((sum, item) => sum + item.count, 0);
  const topperTotal = topperData.reduce((sum, item) => sum + item.count, 0);
  const feedbackTotal = feedbackData.reduce((sum, item) => sum + item.count, 0);
  const lastYearTotal = lastYearStatusData.reduce((sum, item) => sum + item.count, 0);
  const statusPieSegments = buildPieSegments(reportBreakdown, reportTotalCount);
  const academicYearSegments = buildPieSegments(academicYearData, academicYearTotal);
  const departmentWiseSegments = buildPieSegments(departmentWiseData, departmentWiseTotal);
  const applicationTypeSegments = buildPieSegments(applicationTypeData, applicationTypeTotal);
  const categoryWiseSegments = buildPieSegments(categoryWiseData, categoryWiseTotal);
  const topperSegments = buildPieSegments(topperData, topperTotal);
  const feedbackSegments = buildPieSegments(feedbackData, feedbackTotal);
  const lastYearSegments = buildPieSegments(lastYearStatusData, lastYearTotal);

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

  const formatMyReviewAction = (value) => {
    if (value === "approve") return "Approved";
    if (value === "reject") return "Rejected";
    return value || "-";
  };

  const exportApprovedApplicationsPdf = async () => {
    try {
      const liveApprovedByMe = await api
        .myReviewedApplications("approve", { limit: AUTHORITY_FETCH_LIMIT })
        .catch(() => filteredApprovedByMeApps);
      setMyApprovedApps(liveApprovedByMe);
      const approvedRows = (Array.isArray(liveApprovedByMe) ? liveApprovedByMe : [])
        .filter((app) => {
          const searchPass = matchesApplicationSearch(app, approvedSearch);
          const appYear = formatAcademicYear(app?.data?.academic_year, "Not Provided");
          const appYearType = toAcademicYearType(app?.data?.academic_year_type);
          const appDepartment = toReportLabel(app?.data?.department, "Not Provided");
          const yearPass = reportApprovedYearFilter === "all" || appYear === reportApprovedYearFilter;
          const yearTypePass = reportApprovedYearTypeFilter === "all" || appYearType === reportApprovedYearTypeFilter;
          const departmentPass = reportApprovedDepartmentFilter === "all" || appDepartment === reportApprovedDepartmentFilter;
          return searchPass && yearPass && yearTypePass && departmentPass;
        })
        .filter((app) => app.status === "approved");
      const studentApproved = approvedRows.filter((app) => app.application_type === "student");
      const facultyApproved = approvedRows.filter((app) => app.application_type === "faculty");
      const amountAsNumber = (app) => {
        const amount = Number(getInstitutionCoordinatorApprovedAmount(app));
        return Number.isFinite(amount) ? amount : 0;
      };
      const formatAmount = (value) => Number(value || 0).toFixed(2);
      const studentTotal = studentApproved.reduce((sum, app) => sum + amountAsNumber(app), 0);
      const facultyTotal = facultyApproved.reduce((sum, app) => sum + amountAsNumber(app), 0);
      const grandTotal = studentTotal + facultyTotal;

      const { default: jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default || autoTableModule.autoTable;
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const margin = 28;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const headerImageDataUrl = await getPdfHeaderImageDataUrl().catch(() => null);
      const exportYearLabel = reportApprovedYearFilter === "all" ? "All Academic Years" : reportApprovedYearFilter;
      const exportYearTypeLabel = reportApprovedYearTypeFilter === "all" ? "All Types" : reportApprovedYearTypeFilter;
      const exportDepartmentLabel = reportApprovedDepartmentFilter === "all" ? "All Departments" : reportApprovedDepartmentFilter;
      const drawReportHeader = ({ showMainTitle = false } = {}) => {
        const metaBottomY = drawPdfHeader(doc, {
          margin,
          title: "",
          subtitle: "",
          headerImageDataUrl
        });
        if (showMainTitle) {
          const centeredTitleY = metaBottomY + 16;
          doc.setFont("times", "bold");
          doc.setTextColor(31, 41, 55);
          doc.setFontSize(15);
          doc.text("NPTEL Approved Applications Report", pageWidth / 2, centeredTitleY, { align: "center" });
          return centeredTitleY + 16;
        }
        return metaBottomY + 8;
      };

      const studentBody = studentApproved.map((app, index) => {
        const data = app.data || {};
        const bankNameAndBranch = [data.bank_name || "-", data.bank_branch || "-"].join(" / ");
        const yearLabel = formatAcademicYear(data.academic_year, "-");
        const yearTypeLabel = toAcademicYearType(data.academic_year_type);
        const yearAndType = yearTypeLabel === "Not Provided" ? yearLabel : `${yearLabel} (${yearTypeLabel})`;
        return [
          String(index + 1),
          data.applicant_name || data.application_name || "-",
          data.mobile_number || "-",
          data.department || "-",
          yearAndType,
          data.bank_account_number || "-",
          data.bank_ifsc || "-",
          bankNameAndBranch,
          formatAmount(amountAsNumber(app))
        ];
      });
      if (studentBody.length === 0) {
        studentBody.push(["-", "No approved student applications.", "-", "-", "-", "-", "-", "-", "-"]);
      }
      studentBody.push(["", "", "", "", "", "", "", "Student Total (Rs)", formatAmount(studentTotal)]);

      const facultyBody = facultyApproved.map((app, index) => {
        const data = app.data || {};
        const yearLabel = formatAcademicYear(data.academic_year, "-");
        const yearTypeLabel = toAcademicYearType(data.academic_year_type);
        const yearAndType = yearTypeLabel === "Not Provided" ? yearLabel : `${yearLabel} (${yearTypeLabel})`;
        return [
          String(index + 1),
          data.application_name || data.applicant_name || "-",
          data.mobile_number || "-",
          data.department || "-",
          yearAndType,
          data.designation || "-",
          formatAmount(amountAsNumber(app))
        ];
      });
      if (facultyBody.length === 0) {
        facultyBody.push(["-", "No approved faculty applications.", "-", "-", "-", "-", "-"]);
      }
      facultyBody.push(["", "", "", "", "", "Faculty Total (Rs)", formatAmount(facultyTotal)]);

      let cursorY = drawReportHeader({ showMainTitle: true });
      doc.setFont("times", "bold");
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(12);
      doc.text("Student Applications", margin, cursorY);
      const studentTableStartY = cursorY + 8;

      autoTable(doc, {
        startY: studentTableStartY,
        margin: { left: margin, right: margin, top: studentTableStartY },
        head: [[
          "Sr No",
          "Applicant Name",
          "Contact Number",
          "Department",
          "Academic Year / Type",
          "Account Number",
          "IFSC Code",
          "Bank Name And Branch",
          "Approved Amount"
        ]],
        body: studentBody,
        theme: "grid",
        styles: { font: "times", fontSize: 8, cellPadding: 3, valign: "top", textColor: 30 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 32, halign: "center" },
          1: { cellWidth: 76 },
          2: { cellWidth: 58 },
          3: { cellWidth: 50 },
          4: { cellWidth: 64 },
          5: { cellWidth: 64 },
          6: { cellWidth: 50 },
          7: { cellWidth: 92 },
          8: { cellWidth: 53, halign: "right" }
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === studentBody.length - 1) {
            data.cell.styles.fontStyle = "bold";
          }
        },
        didDrawPage: (data) => {
          if (data.pageNumber <= 1) return;
          const top = drawReportHeader();
          doc.setFont("times", "bold");
          doc.setTextColor(31, 41, 55);
          doc.setFontSize(12);
          doc.text("Student Applications", margin, top);
        }
      });

      cursorY = (doc.lastAutoTable?.finalY || studentTableStartY) + 18;
      if (cursorY > pageHeight - 170) {
        doc.addPage();
        cursorY = drawReportHeader();
      }

      doc.setFont("times", "bold");
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(12);
      doc.text("Faculty Applications", margin, cursorY);
      const facultyTableStartY = cursorY + 8;

      autoTable(doc, {
        startY: facultyTableStartY,
        margin: { left: margin, right: margin, top: facultyTableStartY },
        head: [[
          "Sr No",
          "Application Name",
          "Contact Number",
          "Department",
          "Academic Year / Type",
          "Designation",
          "Approved Amount"
        ]],
        body: facultyBody,
        theme: "grid",
        styles: { font: "times", fontSize: 8, cellPadding: 3, valign: "top", textColor: 30 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 30, halign: "center" },
          1: { cellWidth: 118 },
          2: { cellWidth: 88 },
          3: { cellWidth: 70 },
          4: { cellWidth: 74 },
          5: { cellWidth: 78 },
          6: { cellWidth: 80, halign: "right" }
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === facultyBody.length - 1) {
            data.cell.styles.fontStyle = "bold";
          }
        },
        didDrawPage: (data) => {
          if (data.pageNumber <= 1) return;
          const top = drawReportHeader();
          doc.setFont("times", "bold");
          doc.setTextColor(31, 41, 55);
          doc.setFontSize(12);
          doc.text("Faculty Applications", margin, top);
        }
      });

      const finalY = (doc.lastAutoTable?.finalY || facultyTableStartY) + 18;
      const totalLabel = `Overall Total Amount (Rs): ${formatAmount(grandTotal)}`;
      const signatureBlockHeight = 104;
      const signatureTopAtBottom = pageHeight - margin - signatureBlockHeight;
      let totalTextY = finalY;
      if (finalY > signatureTopAtBottom - 22) {
        doc.addPage();
        const top = drawReportHeader();
        doc.setFont("times", "bold");
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(13);
        totalTextY = top + 4;
        doc.text(totalLabel, margin, totalTextY);
      } else {
        doc.setFont("times", "bold");
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(13);
        totalTextY = finalY;
        doc.text(totalLabel, margin, totalTextY);
      }
      const signatureTop = signatureTopAtBottom;
      doc.setFont("times", "bold");
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(13);
      doc.text("Signatures", margin, signatureTop);

      const signerNames = [
        "Dr. Rashmi Jain (NPTEL Coordinator)",
        "Dr. S. L. Badjate (principal)",
        "Mr. Sanjeev Agrawal (CEO)"

      ];
      const signatureLineY = signatureTop + 58;
      const signatureTextY = signatureLineY + 20;
      const availableWidth = pageWidth - (margin * 2);
      const signatureSlot = availableWidth / signerNames.length;

      doc.setDrawColor(107, 114, 128);
      doc.setLineWidth(0.8);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      signerNames.forEach((name, index) => {
        const slotLeft = margin + (index * signatureSlot);
        const slotCenter = slotLeft + (signatureSlot / 2);
        const lineHalf = Math.min(68, (signatureSlot * 0.34));
        doc.line(slotCenter - lineHalf, signatureLineY, slotCenter + lineHalf, signatureLineY);
        doc.text(name, slotCenter, signatureTextY, { align: "center", maxWidth: signatureSlot - 8 });
      });

      doc.save(`approved-applications-${reportDateTag}.pdf`);
      setReportNotice("Approved applications exported as A4 PDF with header.");
    } catch (err) {
      setReportNotice(err?.message || "Failed to export approved applications PDF.");
    }
  };

  const exportApprovedApplicationsExcel = async () => {
    try {
      const liveApprovedByMe = await api
        .myReviewedApplications("approve", { limit: AUTHORITY_FETCH_LIMIT })
        .catch(() => filteredApprovedByMeApps);
      setMyApprovedApps(liveApprovedByMe);
      const approvedRows = (Array.isArray(liveApprovedByMe) ? liveApprovedByMe : [])
        .filter((app) => {
          const searchPass = matchesApplicationSearch(app, approvedSearch);
          const appYear = formatAcademicYear(app?.data?.academic_year, "Not Provided");
          const appYearType = toAcademicYearType(app?.data?.academic_year_type);
          const appDepartment = toReportLabel(app?.data?.department, "Not Provided");
          const yearPass = reportApprovedYearFilter === "all" || appYear === reportApprovedYearFilter;
          const yearTypePass = reportApprovedYearTypeFilter === "all" || appYearType === reportApprovedYearTypeFilter;
          const departmentPass = reportApprovedDepartmentFilter === "all" || appDepartment === reportApprovedDepartmentFilter;
          return searchPass && yearPass && yearTypePass && departmentPass;
        })
        .filter((app) => app.status === "approved");

      const headers = [
        "Application ID",
        "Applicant",
        "Type",
        "Department",
        "Academic Year",
        "Academic Year Type",
        "Submitted At",
        "Approved Amount (Rs)"
      ];
      const escapeCsv = (value) => {
        const safe = String(value ?? "").replace(/"/g, "\"\"");
        return `"${safe}"`;
      };
      const csvRows = [
        headers.map(escapeCsv).join(","),
        ...approvedRows.map((app) => ([
          app.id,
          app?.data?.applicant_name || app?.data?.application_name || "-",
          app?.application_type || "-",
          app?.data?.department || "-",
          formatAcademicYear(app?.data?.academic_year, "-"),
          toAcademicYearType(app?.data?.academic_year_type),
          app?.created_at ? new Date(app.created_at).toLocaleString() : "-",
          Number(getInstitutionCoordinatorApprovedAmount(app) || 0).toFixed(2)
        ]).map(escapeCsv).join(","))
      ];
      const csv = `\ufeff${csvRows.join("\r\n")}`;
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `approved-applications-${reportDateTag}.csv`);
      setReportNotice("Approved applications exported as Excel.");
    } catch (err) {
      setReportNotice(err?.message || "Failed to export approved applications Excel.");
    }
  };

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const captureGraphCanvas = async () => {
    const target = graphContainerRef.current;
    if (!target) {
      throw new Error("Graph view is not ready yet.");
    }
    const html2canvasModule = await import("html2canvas");
    const html2canvas = html2canvasModule.default || html2canvasModule;
    return html2canvas(target, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false
    });
  };

  const captureAllGraphCards = async () => {
    const target = allGraphsPdfRef.current;
    if (!target) {
      throw new Error("All graphs are not ready yet.");
    }
    const cards = Array.from(target.querySelectorAll("[data-graph-export-card]"));
    if (cards.length === 0) {
      throw new Error("No graphs found for export.");
    }
    const html2canvasModule = await import("html2canvas");
    const html2canvas = html2canvasModule.default || html2canvasModule;
    const rendered = [];
    for (const card of cards) {
      const canvas = await html2canvas(card, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        width: card.scrollWidth,
        height: card.scrollHeight,
        windowWidth: card.scrollWidth,
        windowHeight: card.scrollHeight
      });
      rendered.push({
        title: card.getAttribute("data-graph-title") || "Graph",
        canvas
      });
    }
    return rendered;
  };

  const fitCanvasWithinBox = (sourceWidth, sourceHeight, maxWidth, maxHeight) => {
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    return {
      width: sourceWidth * scale,
      height: sourceHeight * scale
    };
  };

  const drawGraphCollagePage = (doc, graphCards, options = {}) => {
    const {
      margin = 24,
      columns = 3,
      gap = 12,
      title = "",
      subtitle = "",
      metadataLines = [],
      headerImageDataUrl = null
    } = options;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentTop = drawPdfHeader(doc, {
      margin,
      title,
      subtitle,
      metadataLines,
      headerImageDataUrl
    });
    const rows = Math.max(1, Math.ceil(graphCards.length / columns));
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - contentTop - margin;
    const cellWidth = (availableWidth - (gap * (columns - 1))) / columns;
    const cellHeight = (availableHeight - (gap * (rows - 1))) / rows;

    graphCards.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cellLeft = margin + (column * (cellWidth + gap));
      const cellTop = contentTop + (row * (cellHeight + gap));
      const fit = fitCanvasWithinBox(item.canvas.width, item.canvas.height, cellWidth, cellHeight);
      const drawLeft = cellLeft + ((cellWidth - fit.width) / 2);
      const drawTop = cellTop + ((cellHeight - fit.height) / 2);
      doc.addImage(item.canvas.toDataURL("image/png"), "PNG", drawLeft, drawTop, fit.width, fit.height, undefined, "FAST");
    });

    return contentTop;
  };

  const exportGraphImage = async () => {
    try {
      const canvas = await captureGraphCanvas();
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `graph-report-all-${reportDateTag}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setReportNotice("All graphs image exported.");
    } catch (err) {
      setReportNotice(err?.message || "Failed to export graph image.");
    }
  };

  const exportGraphPdf = async () => {
    try {
      const graphCards = await captureAllGraphCards();
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const margin = 20;
      const generatedAt = new Date().toLocaleString();
      const headerImageDataUrl = await getPdfHeaderImageDataUrl().catch(() => null);
      drawGraphCollagePage(doc, graphCards, {
        margin,
        columns: 3,
        gap: 10,
        title: "Institution Coordinator Graph Report",
        subtitle: "S. B. Jain Institute of Technology, Management & Research, Nagpur",
        metadataLines: [
          `Generated: ${generatedAt}`,
          `Graphs included: ${graphCards.length}`,
          "Portrait A4 layout."
        ],
        headerImageDataUrl
      });

      doc.save(`graph-report-all-graphs-a4-${reportDateTag}.pdf`);
      setReportNotice("Graph PDF exported on A4 portrait.");
    } catch (err) {
      setReportNotice(err?.message || "Failed to export graph PDF.");
    }
  };

  const exportReportExcel = () => {
    const headers = [
      "Application ID",
      "Applicant",
      "Type",
      "Department",
      "Mobile",
      "Email",
      "Status",
      "Approved Amount (Rs)",
      "Created At"
    ];
    const escapeCsv = (value) => {
      const safe = String(value ?? "").replace(/"/g, "\"\"");
      return `"${safe}"`;
    };
    const csvRows = [
      headers.map(escapeCsv).join(","),
      ...reportRows.map((row) => ([
        row.id,
        row.applicant,
        row.type,
        row.department,
        row.mobile,
        row.email,
        row.status,
        formatRs(row.approvedAmount),
        row.createdAt
      ]).map(escapeCsv).join(","))
    ];
    const csv = `\ufeff${csvRows.join("\r\n")}`;
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `institution-report-${reportDateTag}.csv`);
  };

  const exportStudentSectionExcel = () => {
    const headers = [
      "Application ID",
      "Applicant",
      "Department",
      "Academic Year",
      "Category",
      "NPTEL Roll Number",
      "Score",
      "Approved Amount (Rs)",
      "Created At"
    ];
    const escapeCsv = (value) => {
      const safe = String(value ?? "").replace(/"/g, "\"\"");
      return `"${safe}"`;
    };
    const csvRows = [
      headers.map(escapeCsv).join(","),
      ...filteredStudentRows.map((row) => ([
        row.id,
        row.applicant,
        row.department,
        row.academicYear,
        row.courseCategory,
        row.nptelApplicationNumber,
        row.score,
        formatRs(row.approvedAmount),
        row.createdAt
      ]).map(escapeCsv).join(","))
    ];
    const csv = `\ufeff${csvRows.join("\r\n")}`;
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `student-section-report-${reportDateTag}.csv`);
    setReportNotice("Student section Excel exported.");
  };

  const exportReportWord = () => {
    const summaryHtml = reportBreakdown
      .map((item) => `<li>${item.label}: ${item.count}</li>`)
      .join("");
    const rowsHtml = reportRows
      .map((row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.applicant}</td>
          <td>${row.type}</td>
          <td>${row.department}</td>
          <td>${row.mobile}</td>
          <td>${row.email}</td>
          <td>${row.status}</td>
          <td>${formatRs(row.approvedAmount)}</td>
          <td>${row.createdAt}</td>
        </tr>
      `)
      .join("");
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Institution Coordinator Report</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
      h1 { margin-bottom: 6px; }
      .meta { margin-bottom: 12px; color: #444; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 11px; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>Institution Coordinator Report</h1>
    <div class="meta">Generated: ${new Date().toLocaleString()}</div>
    <div class="meta">Total Applications: ${reportRows.length} | Approved Total (Rs): ${formatRs(reportApprovedTotalAmount)}</div>
    <ul>${summaryHtml}</ul>
    <table>
      <thead>
        <tr>
          <th>Application ID</th>
          <th>Applicant</th>
          <th>Type</th>
          <th>Department</th>
          <th>Mobile</th>
          <th>Email</th>
          <th>Status</th>
          <th>Approved Amount (Rs)</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="9">No applications found.</td></tr>'}
      </tbody>
    </table>
  </body>
</html>`;
    downloadBlob(new Blob([html], { type: "application/msword" }), `institution-report-${reportDateTag}.doc`);
  };

  const exportReportPdf = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default || autoTableModule.autoTable;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
      const margin = 32;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const generatedAt = new Date().toLocaleString();
      const graphCards = await captureAllGraphCards();
      const headerImageDataUrl = await getPdfHeaderImageDataUrl().catch(() => null);
      drawGraphCollagePage(doc, graphCards, {
        margin,
        columns: 3,
        gap: 12,
        title: "Institution Coordinator Report",
        subtitle: "S. B. Jain Institute of Technology, Management & Research, Nagpur",
        metadataLines: [
          `Generated: ${generatedAt}`,
          `Total Applications: ${reportRows.length} | Approved Total (Rs): ${formatRs(reportApprovedTotalAmount)}`,
          "All graphs are arranged on one page."
        ],
        headerImageDataUrl
      });

      doc.addPage();
      const tableStartY = drawPdfHeader(doc, {
        margin,
        title: "Applications Table",
        subtitle: "S. B. Jain Institute of Technology, Management & Research, Nagpur",
        metadataLines: [
          `Generated: ${generatedAt}`,
          `Total Applications: ${reportRows.length} | Approved Total (Rs): ${formatRs(reportApprovedTotalAmount)}`
        ],
        headerImageDataUrl
      });

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin, top: tableStartY },
        head: [[
          "ID",
          "Applicant",
          "Type",
          "Department",
          "Mobile",
          "Email",
          "Status",
          "Approved Rs",
          "Created At"
        ]],
        body: reportRows.map((row) => ([
          String(row.id),
          row.applicant,
          row.type,
          row.department,
          row.mobile,
          row.email,
          row.status,
          formatRs(row.approvedAmount),
          row.createdAt
        ])),
        styles: { fontSize: 8, cellPadding: 3, valign: "top", font: "times" },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
        theme: "grid",
        didDrawPage: (data) => {
          if (data.pageNumber === 1) return;
          drawPdfHeader(doc, {
            margin,
            title: "Applications Table",
            subtitle: "S. B. Jain Institute of Technology, Management & Research, Nagpur",
            metadataLines: [
              `Generated: ${generatedAt}`,
              `Total Applications: ${reportRows.length} | Approved Total (Rs): ${formatRs(reportApprovedTotalAmount)}`,
              `Page ${data.pageNumber}`
            ],
            headerImageDataUrl
          });
        }
      });
      doc.save(`institution-report-${reportDateTag}.pdf`);
      setReportNotice("PDF exported with all graphs on one page and the report table.");
    } catch (err) {
      setReportNotice(err?.message || "Failed to export PDF.");
    }
  };

  const renderPieCard = (title, items, segments, totalCount, emptyText = "No data available") => (
    <div className="min-w-0 rounded-2xl border border-black/10 bg-white/75 p-4">
      <div className="text-sm font-semibold leading-snug text-black/80">{title}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex items-center justify-center">
          {totalCount === 0 ? (
            <div className="text-xs text-black/50">{emptyText}</div>
          ) : (
            <svg width="170" height="170" viewBox="0 0 220 220" role="img" aria-label={title}>
              <circle cx="110" cy="110" r="72" fill="none" stroke="#e5e7eb" strokeWidth="28" />
              <g transform="rotate(-90 110 110)">
                {segments.map((segment) => (
                  <circle
                    key={`${title}-${segment.label}`}
                    cx="110"
                    cy="110"
                    r={segment.radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="28"
                    strokeLinecap="butt"
                    strokeDasharray={`${segment.length} ${segment.circumference - segment.length}`}
                    strokeDashoffset={-segment.offset}
                  />
                ))}
              </g>
              <text x="110" y="103" textAnchor="middle" fontSize="21" fontWeight="700" fill="#111827">{totalCount}</text>
              <text x="110" y="121" textAnchor="middle" fontSize="10" fill="#6b7280">TOTAL</text>
            </svg>
          )}
        </div>
        <div className="space-y-2">
          {items.map((item) => {
            const percent = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : "0.0";
            return (
              <div key={`${title}-legend-${item.label}`} className="rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="min-w-0 break-words leading-tight">{item.label}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{item.count} ({percent}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderBarCard = (title, items, totalCount, emptyText = "No data available") => (
    <div className="min-w-0 rounded-2xl border border-black/10 bg-white/75 p-4">
      <div className="text-sm font-semibold leading-snug text-black/80">{title}</div>
      {totalCount === 0 ? (
        <div className="mt-3 text-xs text-black/50">{emptyText}</div>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => {
            const percent = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
            return (
              <div key={`${title}-bar-${item.key || item.label}`}>
                <div className="mb-1 flex items-center justify-between text-xs text-black/70">
                  <span className="min-w-0 break-words leading-tight">{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/10">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${percent}%`, background: item.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderGraphByType = (title, items, segments, totalCount, emptyText = "No data available") => (
    reportChartType === "pie"
      ? renderPieCard(title, items, segments, totalCount, emptyText)
      : renderBarCard(title, items, totalCount, emptyText)
  );

  const renderMonthlyTrendCard = () => (
    <div className="rounded-2xl border border-black/10 bg-white/75 p-4">
      <div className="text-sm font-semibold text-black/80">Yearly Application Trend (Line Graph)</div>
      {yearWiseLineData.length === 0 ? (
        <div className="mt-3 text-xs text-black/50">No academic-year data from 2024-2025 onward.</div>
      ) : (
        <div className="mt-3 overflow-x-auto pb-1">
          <svg
            className="min-w-[860px]"
            width={yearWiseSvg.width}
            height={yearWiseSvg.height}
            viewBox={`0 0 ${yearWiseSvg.width} ${yearWiseSvg.height}`}
            role="img"
            aria-label="Yearly application trend line graph"
          >
            {yearWiseLineTicks.map((value) => {
              const y = yearWiseSvg.paddingTop + ((1 - (value / yearWiseLineMax)) * yearWisePlotHeight);
              return (
                <g key={`year-grid-${value}`}>
                  <line
                    x1={yearWiseSvg.paddingX}
                    y1={y}
                    x2={yearWiseSvg.width - yearWiseSvg.paddingX}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <text x={yearWiseSvg.paddingX - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
                    {value}
                  </text>
                </g>
              );
            })}

            <path d={yearWiseLinePath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
            {yearWiseLinePoints.map((point) => (
              <g key={`year-point-trend-${point.key}`}>
                <circle cx={point.x} cy={point.y} r="3.4" fill="#16a34a" />
                <text x={point.x} y={yearWiseSvg.height - 12} textAnchor="middle" fontSize="9" fill="#4b5563">
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );

  const renderYearWiseLineCard = () => (
    <div className="rounded-2xl border border-black/10 bg-white/75 p-4">
      <div className="text-sm font-semibold text-black/80">
        Year Wise Applications Line Graph (2024-2025 Onward)
      </div>
      {yearWiseLineData.length === 0 ? (
        <div className="mt-3 text-xs text-black/50">No academic-year data from 2024-2025 onward.</div>
      ) : (
        <div className="mt-3 overflow-x-auto pb-1">
          <svg
            className="min-w-[860px]"
            width={yearWiseSvg.width}
            height={yearWiseSvg.height}
            viewBox={`0 0 ${yearWiseSvg.width} ${yearWiseSvg.height}`}
            role="img"
            aria-label="Year wise applications line graph from 2024-2025 onward"
          >
            {yearWiseLineTicks.map((value) => {
              const y = yearWiseSvg.paddingTop + ((1 - (value / yearWiseLineMax)) * yearWisePlotHeight);
              return (
                <g key={`year-grid-${value}`}>
                  <line
                    x1={yearWiseSvg.paddingX}
                    y1={y}
                    x2={yearWiseSvg.width - yearWiseSvg.paddingX}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <text x={yearWiseSvg.paddingX - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
                    {value}
                  </text>
                </g>
              );
            })}

            <path d={yearWiseLinePath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
            {yearWiseLinePoints.map((point) => (
              <g key={`year-point-${point.key}`}>
                <circle cx={point.x} cy={point.y} r="3.4" fill="#16a34a" />
                <text x={point.x} y={yearWiseSvg.height - 12} textAnchor="middle" fontSize="9" fill="#4b5563">
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );

  const renderSelectedReportGraph = (graphKey) => {
    if (graphKey === "all_applications") {
      return renderGraphByType("All Applications Status Graph", reportBreakdown, statusPieSegments, reportTotalCount);
    }
    if (graphKey === "academic_year") {
      return renderGraphByType(
        "Academic Year and Academic Year Type Wise Graph",
        academicYearData,
        academicYearSegments,
        academicYearTotal
      );
    }
    if (graphKey === "topper") {
      return renderGraphByType("Topper Category Wise Graph", topperData, topperSegments, topperTotal, "No topper category applications.");
    }
    if (graphKey === "department_wise") {
      return renderGraphByType(
        "Department Wise Applications Graph",
        departmentWiseData,
        departmentWiseSegments,
        departmentWiseTotal,
        "No department applications."
      );
    }
    if (graphKey === "application_type") {
      return renderGraphByType(
        "Faculty vs Student Applications Graph",
        applicationTypeData,
        applicationTypeSegments,
        applicationTypeTotal,
        "No application type data."
      );
    }
    if (graphKey === "category_wise") {
      return renderGraphByType("Category Wise Graph", categoryWiseData, categoryWiseSegments, categoryWiseTotal);
    }
    if (graphKey === "feedback") {
      return renderGraphByType("Feedback Rating Graph", feedbackData, feedbackSegments, feedbackTotal, "No feedback submissions yet.");
    }
    if (graphKey === "last_year") {
      return renderGraphByType(`Last Year (${lastYear}) Graph`, lastYearStatusData, lastYearSegments, lastYearTotal, `No applications in ${lastYear}`);
    }
    if (graphKey === "monthly_trend") {
      return renderMonthlyTrendCard();
    }
    return null;
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

  const submitFormWindow = async (e) => {
    e.preventDefault();
    setFormWindowMessage("");
    try {
      if (!formWindowForm.start_date || !formWindowForm.end_date) {
        setFormWindowMessage("Select both start date and end date.");
        return;
      }
      const updated = await api.adminSetFormWindow(formWindowForm);
      setFormWindowForm({
        start_date: updated?.start_date || "",
        end_date: updated?.end_date || ""
      });
      setFormWindowMessage("Form filling window updated.");
    } catch (err) {
      setFormWindowMessage(err.message || "Failed to update form window.");
    }
  };

  const setAuthorityUserStatus = async (targetUser, nextIsActive) => {
    const userId = Number(targetUser?.id);
    if (!Number.isFinite(userId)) return;
    const actionLabel = nextIsActive ? "activate" : "deactivate";
    setAuthorityUsersMessage({ type: "", text: "" });
    if (!window.confirm(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} authority user ${targetUser?.name || ""}? Record will be retained in database.`)) {
      return;
    }
    setUpdatingAuthorityUserId(userId);
    try {
      const result = await api.coordinatorSetAuthorityUserStatus(userId, nextIsActive);
      await loadAuthorityUsers(authorityFilter.trim());
      setAuthorityUsersMessage({
        type: "success",
        text: result?.message || `Authority user ${nextIsActive ? "activated" : "deactivated"}.`
      });
    } catch (err) {
      setAuthorityUsersMessage({
        type: "error",
        text: err.message || `Failed to ${actionLabel} authority user.`
      });
    } finally {
      setUpdatingAuthorityUserId(null);
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
    const href = path.startsWith("http") ? path : resolveMediaUrl(path);
    return (
      <a className="text-black underline" href={href} target="_blank" rel="noreferrer">
        View
      </a>
    );
  };

  return (
    <div className="dashboard-page" style={{ background: "var(--bg-base)" }}>
      <div className="page-container" style={{ maxWidth: "none" }}>
        <div className="mb-4 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg" style={{ background: "var(--accent-gradient)" }}></div>
            <span className="text-base font-bold font-display" style={{ color: "var(--text-primary)" }}>Authority Portal</span>
          </div>
        </div>

        <div className="dashboard-shell">
          <div className="dashboard-sidebar">
            <Sidebar items={menu} active={active} onSelect={handleSelect} user={user} />
          </div>
          <div className="dashboard-content animate-slide-up">
            <Topbar title="Authority Portal" subtitle={`Welcome, ${user?.name || "Authority"}`} />

            {loading ? (
              <DashboardSkeleton activeTab={active} />
            ) : (
              <>
                {active === "Overview" && (
                  <div className="mt-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Pending", value: apps.length, sub: "Awaiting your action" },
                        { label: "Total Applications", value: scopedAllApps.length, sub: "In your scope" },
                        { label: "Role", value: ROLE_LABELS[user?.role] || user?.role, sub: "Active profile", isText: true },
                        { label: "Department", value: user?.department || "-", sub: "Assigned unit", isText: true }
                      ].map((s) => (
                        <div key={s.label} className="stat-card animate-slide-up">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "var(--text-muted)" }}>{s.label}</span>
                          </div>
                          <div className={`font-bold ${s.isText ? "text-lg" : "text-3xl"}`} style={{ color: "var(--text-primary)" }}>{s.value}</div>
                          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>

                    <div className="form-section">
                      <div className="form-section-header">
                        <div>
                          <h3 className="font-semibold font-display text-lg" style={{ color: "var(--text-primary)" }}>Applications Summary</h3>
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Live breakdown of all application statuses</p>
                        </div>
                        <span className="badge">Live</span>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {[
                          { label: "Pending", value: apps.length, color: "var(--accent-primary)" },
                          { label: "Total", value: scopedAllApps.length, color: "var(--accent-secondary)" },
                          { label: "My Approved", value: approvedByMeApps.length, color: "#10b981" },
                          { label: "Rejected", value: rejectedAppsCount, color: "#f43f5e" }
                        ].map((item) => (
                          <div key={item.label} className="rounded-2xl p-4 border" style={{ background: "var(--surface-glass)", borderColor: "var(--border-subtle)" }}>
                            <div className="flex items-center justify-between text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                              <span>{item.label}</span>
                              <span className="text-xl font-bold">{item.value}</span>
                            </div>
                            <div className="h-2 w-full rounded-full" style={{ background: "var(--border-subtle)" }}>
                              <div className="h-2 rounded-full transition-all duration-700" style={{
                                width: `${Math.min(100, Math.round((item.value / Math.max(scopedAllApps.length, 1)) * 100))}%`,
                                background: item.color
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {active === "Application Form" && (
                  <div className="mt-8 animate-slide-up">
                    <div className="form-section">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
                            Application Form
                          </h2>
                          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                            Submit your reimbursement application with the same review workflow used across the portal.
                          </p>
                        </div>
                        <span className="badge">Live</span>
                      </div>

                      <form onSubmit={submitApplication} className="mt-6 space-y-5 pb-24 sm:mt-8 sm:space-y-6">
                        <div className="form-section">
                          <div className="form-section-header">
                            <div className="form-section-title">Applicant Details</div>
                            <div className="form-section-subtitle">Authority profile</div>
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
                                      name="authorityAcademicYearType"
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
                              <select
                                className="input mt-2"
                                value={form.incentiveClaimCount}
                                onChange={(e) => setForm({ ...form, incentiveClaimCount: e.target.value })}
                                required
                              >
                                {INCENTIVE_CLAIM_OPTIONS.map((count) => (
                                  <option key={count} value={count}>
                                    {count}
                                  </option>
                                ))}
                              </select>
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
                            <button className="btn btn-primary w-full sm:w-auto" type="submit" disabled={isSubmittingApplication}>
                              {isSubmittingApplication ? "Submitting..." : "Submit Application"}
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
                                incentiveClaimCount: DEFAULT_INCENTIVE_CLAIM_COUNT,
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

                {active === "Pending Applications" && (
                  <div className="mt-6 animate-slide-up">
                    <div className="form-section-header" style={{ marginBottom: "1.25rem" }}>
                      <div>
                        <h2 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>Pending Applications</h2>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{filteredPendingApps.length} application(s) awaiting review</p>
                      </div>
                      <button className="btn btn-ghost" type="button" onClick={refresh}>Refresh</button>
                    </div>
                    <div className="mt-4 w-full lg:max-w-xl">
                      <label className="text-xs uppercase tracking-[0.2em] text-black/40">Search Pending Applications</label>
                      <input
                        className="input mt-2"
                        type="search"
                        placeholder="Search by name, ID, USN, department, course title"
                        value={pendingSearch}
                        onChange={(e) => {
                          setPendingSearch(e.target.value);
                          setPendingPage(1);
                        }}
                      />
                    </div>
                    {message && <div className="mt-3 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>{message}</div>}
                    <div className="mt-4 grid gap-5">
                      {pendingPageData.rows.map((app) => (
                        <div key={app.id} className="form-section animate-slide-up">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{app.data.applicant_name || app.data.application_name || `Application #${app.id}`}</div>
                            <span className="badge">{app.status}</span>
                          </div>
                          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            {app.application_type ? `ID: ${app.id} | Type: ${app.application_type}` : `ID: ${app.id}`}
                          </div>
                          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2" style={{ color: "var(--text-secondary)" }}>
                            {[
                              ["Applicant", app.data.applicant_name || app.data.application_name || ""],
                              ["Department", app.data.department],
                              ["USN", app.data.usn],
                              ["Email", app.data.email],
                              ["Mobile", app.data.mobile_number],
                              ["Designation", app.data.designation],
                              ["Semester", app.data.semester],
                              ["Academic Year", formatAcademicYear(app.data.academic_year, "")],
                              ["Academic Year Type", app.data.academic_year_type],
                              ["Claims", app.data.incentive_claim_count],
                              ["Course", app.data.course_title],
                              ["NPTEL Roll Number", app.data.nptel_application_number],
                              ["Platform", app.data.course_platform],
                              ["Session", app.data.course_session],
                              ["Weeks", app.data.course_weeks],
                              ["Score", app.data.course_score],
                              ["Category", app.data.course_category],
                              ["Credits", app.data.course_credits],
                              ["Fee Paid", app.data.registration_fee_paid],
                              ["Permissible Claim", app.data.permissible_claim],
                              ["Bank Acct", app.data.bank_account_number],
                              ["Bank IFSC", app.data.bank_ifsc],
                              ["Bank Branch", app.data.bank_branch],
                              ["Bank Name", app.data.bank_name],
                              ["Declaration", app.data.declaration_accepted ? "Yes" : "No"],
                              ["Dept Coordinator Approved Amt", (() => { const a = getApprovedAmountByRole(app, "department_coordinator"); return a && a !== "-" ? `Rs. ${a}` : ""; })()]
                            ]
                              .filter(([, val]) => isDisplayValue(val))
                              .map(([lbl, val]) => (
                                <div key={lbl}><span style={{ color: "var(--text-muted)" }}>{lbl}:</span> {val}</div>
                              ))}
                            {[
                              ["Fee Receipt", app.data.fee_receipt_file],
                              ["Certificate", app.data.certificate_file],
                              ["Bank Passbook", app.data.bank_passbook_file],
                              ["Photograph", app.data.photograph_file],
                              ["Signature", app.data.signature_file]
                            ]
                              .filter(([, path]) => isDisplayValue(path))
                              .map(([lbl, path]) => (
                                <div key={lbl}><span style={{ color: "var(--text-muted)" }}>{lbl}:</span> {docLink(path)}</div>
                              ))}
                          </div>
                          <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                            <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "var(--text-muted)" }}>Rejection Remark (required)</label>
                            <textarea className="input mt-2 h-24" value={rejectRemarks[app.id] || ""} onChange={(e) => setRejectRemarks((prev) => ({ ...prev, [app.id]: e.target.value }))} />
                          </div>
                          {(user?.role === "department_coordinator" || user?.role === "institution_coordinator") && (
                            <div className="mt-4">
                              <label className="text-xs uppercase tracking-widest font-medium" style={{ color: "var(--text-muted)" }}>
                                {user?.role === "institution_coordinator"
                                  ? "Approved Amount (Rs)"
                                  : "Coordinator Approved Amount (Rs, optional)"}
                              </label>
                              <input
                                className="input mt-2"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={approveAmounts[app.id] || ""}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  // allow empty, or digits with up to one decimal point
                                  if (val !== "" && !/^\d*\.?\d*$/.test(val)) return;
                                  setApproveAmounts((prev) => ({ ...prev, [app.id]: val }));
                                }}
                              />
                            </div>
                          )}
                          <div className="mt-5 flex flex-wrap gap-3">
                            <button className="btn btn-ghost" type="button" onClick={() => setSelectedApplication(app)}>
                              View Form
                            </button>
                            <button className="btn btn-primary" type="button" onClick={() => review(app.id, "approve")}>Approve</button>
                            <button className="btn btn-ghost" type="button" onClick={() => review(app.id, "reject")}>Reject</button>
                          </div>
                        </div>
                      ))}
                      {filteredPendingApps.length === 0 && (
                        <div className="form-section text-center py-8">
                          <div className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                            {pendingSearch.trim()
                              ? "No pending applications match your search."
                              : "No pending applications - you're all caught up!"}
                          </div>
                        </div>
                      )}
                    </div>
                    {filteredPendingApps.length > 0 && (
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="muted text-sm">
                          Page {pendingPageData.currentPage} of {pendingPageData.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={pendingPageData.currentPage <= 1}
                            onClick={() => setPendingPage((prev) => Math.max(1, prev - 1))}
                          >
                            Prev
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={pendingPageData.currentPage >= pendingPageData.totalPages}
                            onClick={() => setPendingPage((prev) => Math.min(pendingPageData.totalPages, prev + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {active === "Approved Students / Faculty" && user?.role === "institution_coordinator" && (
                  <div className="mt-8 animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                      <h2 className="text-xl font-semibold font-display">Approved Students & Faculty</h2>
                    </div>
                    <div className="grid min-h-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                      <aside className="panel space-y-4 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">Approved Applicant Search</div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
                            Search by Name
                          </label>
                          <input
                            className="input"
                            placeholder="Applicant name"
                            value={reportStudentSearch}
                            onChange={(e) => setReportStudentSearch(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
                            Academic Year
                          </label>
                          <select
                            className="input"
                            value={reportStudentYearFilter}
                            onChange={(e) => setReportStudentYearFilter(e.target.value)}
                          >
                            <option value="all">All Academic Years</option>
                            {studentYearOptions.map((year) => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
                            Category
                          </label>
                          <select
                            className="input"
                            value={reportStudentCategoryFilter}
                            onChange={(e) => setReportStudentCategoryFilter(e.target.value)}
                          >
                            <option value="all">All Categories</option>
                            {studentCategoryOptions.map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)] px-3 py-2">
                            <span className="text-[color:var(--ink-soft)]">Total Approved:</span> {studentReportRows.length}
                          </div>
                          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)] px-3 py-2">
                            <span className="text-[color:var(--ink-soft)]">Filtered:</span> {filteredStudentRows.length}
                          </div>
                          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)] px-3 py-2">
                            <span className="text-[color:var(--ink-soft)]">Approved Total (Rs):</span> {formatRs(filteredStudentApprovedAmount)}
                          </div>
                        </div>
                        <button className="btn btn-ghost w-full" type="button" onClick={exportStudentSectionExcel}>
                          Export Excel
                        </button>
                      </aside>

                      <div className="panel p-4">
                        <h3 className="text-sm font-semibold text-[color:var(--ink)]">Approved Applicants List</h3>
                        <div className="mt-3 overflow-x-auto">
                          <table className="data-table min-w-[720px]">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Academic Year</th>
                                <th>Department</th>
                                <th>Category</th>
                                <th>Approved Amt (Rs)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStudentRows.map((row) => (
                                <tr key={row.id}>
                                  <td className="font-medium">{row.applicant}</td>
                                  <td>{row.type}</td>
                                  <td>{row.academicYear}</td>
                                  <td>{row.department}</td>
                                  <td>{row.courseCategory}</td>
                                  <td>{formatRs(row.approvedAmount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {filteredStudentRows.length === 0 && (
                            <div className="mt-3 text-sm text-[color:var(--ink-soft)]">No approved applications found.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {active === "My Applications" && (
                  <div className="mt-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold font-display">My Applications</h2>
                      <div className="flex items-center gap-2 text-sm text-[color:var(--ink-soft)]">
                        <span>{filteredMySubmittedApps.length} total</span>
                        <button className="btn btn-ghost" type="button" onClick={loadMyApplications}>
                          Refresh
                        </button>
                      </div>
                    </div>

                    {applicationsNotice && (
                      <div className={`mt-3 text-sm ${applicationsNoticeType === "error" ? "text-rose-600" : "text-emerald-600"}`}>
                        {applicationsNotice}
                      </div>
                    )}

                    <div className="mt-4 w-full lg:max-w-xl">
                      <label className="text-xs uppercase tracking-[0.2em] text-black/40">Search My Applications</label>
                      <input
                        className="input mt-2"
                        type="search"
                        placeholder="Search by name, ID, department, status, or course title"
                        value={myApplicationsSearch}
                        onChange={(e) => {
                          setMyApplicationsSearch(e.target.value);
                          setMyApplicationsPage(1);
                        }}
                      />
                    </div>

                    <div className="mt-4 grid gap-4">
                      {myApplicationsPageData.rows.map((app) => (
                        <div key={app.id} className="panel p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold">{app.data.applicant_name || app.data.application_name || `Application #${app.id}`}</div>
                              <div className="muted mt-1 text-xs">ID: {app.id}</div>
                            </div>
                            <span className="badge">{statusLabel(app.status)}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {flowSteps.map((step, index) => {
                              const currentIndex = flowSteps.findIndex((s) => s.key === app.status);
                              const reached = app.status === "approved" || currentIndex >= index;
                              const isRejected = app.status === "rejected";
                              return (
                                <span
                                  key={step.key}
                                  className={`flow-step ${isRejected
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
                              ["Submitted At", app.created_at ? new Date(app.created_at).toLocaleString() : ""]
                            ]
                              .filter(([, value]) => hasDisplayText(value))
                              .map(([label, value]) => (
                                <div key={label}>
                                  <span className="text-black/50">{label}:</span> {value}
                                </div>
                              ))}
                          </div>

                          <div className="mt-4 flex flex-wrap justify-end gap-2">
                            <button className="btn btn-primary" type="button" onClick={() => setSelectedApplication(app)}>
                              Application Details
                            </button>
                            <button className="btn btn-ghost" type="button" onClick={() => printApplicationForm(app)}>
                              Print Form PDF
                            </button>
                          </div>
                        </div>
                      ))}

                      {filteredMySubmittedApps.length === 0 && (
                        <div className="muted text-sm">
                          {myApplicationsSearch.trim()
                            ? "No submitted applications match your search."
                            : "No applications submitted yet."}
                        </div>
                      )}
                    </div>

                    {filteredMySubmittedApps.length > 0 && (
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="muted text-sm">
                          Page {myApplicationsPageData.currentPage} of {myApplicationsPageData.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={myApplicationsPageData.currentPage <= 1}
                            onClick={() => setMyApplicationsPage((prev) => Math.max(1, prev - 1))}
                          >
                            Prev
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={myApplicationsPageData.currentPage >= myApplicationsPageData.totalPages}
                            onClick={() => setMyApplicationsPage((prev) => Math.min(myApplicationsPageData.totalPages, prev + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {active === "My Approved Applications" && (
                  <div className="mt-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold font-display">My Approved Applications</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <button className="btn btn-ghost" type="button" onClick={refreshApprovedOnly}>Refresh</button>
                        {user?.role === "institution_coordinator" && (
                          <>
                            <button className="btn btn-ghost" type="button" onClick={exportApprovedApplicationsExcel}>
                              Export Excel
                            </button>
                            <button className="btn btn-ghost" type="button" onClick={exportApprovedApplicationsPdf}>
                              Export PDF
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 w-full lg:max-w-xl">
                      <label className="text-xs uppercase tracking-[0.2em] text-black/40">Search Approved Applications</label>
                      <input
                        className="input mt-2"
                        type="search"
                        placeholder="Search by name, ID, department, course title"
                        value={approvedSearch}
                        onChange={(e) => {
                          setApprovedSearch(e.target.value);
                          setApprovedPage(1);
                        }}
                      />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Academic Year</label>
                        <select
                          className="input mt-2"
                          value={reportApprovedYearFilter}
                          onChange={(e) => {
                            setReportApprovedYearFilter(e.target.value);
                            setApprovedPage(1);
                          }}
                        >
                          <option value="all">All Academic Years</option>
                          {approvedByMeYearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Academic Year Type</label>
                        <select
                          className="input mt-2"
                          value={reportApprovedYearTypeFilter}
                          onChange={(e) => {
                            setReportApprovedYearTypeFilter(e.target.value);
                            setApprovedPage(1);
                          }}
                        >
                          <option value="all">All Types</option>
                          {approvedByMeYearTypeOptions.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Department</label>
                        <select
                          className="input mt-2"
                          value={reportApprovedDepartmentFilter}
                          onChange={(e) => {
                            setReportApprovedDepartmentFilter(e.target.value);
                            setApprovedPage(1);
                          }}
                        >
                          <option value="all">All Departments</option>
                          {approvedByMeDepartmentOptions.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4">
                      {approvedPageData.rows.map((app) => (
                        <div key={app.id} className="panel p-4">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold">{app.data.applicant_name || app.data.application_name || `Application #${app.id}`}</div>
                            <span className="badge">{app.status}</span>
                          </div>
                          <div className="muted mt-2 text-xs">ID: {app.id}</div>
                          <div className="mt-3 grid gap-2 text-sm text-black/70">
                            {[
                              { label: "Department", value: app.data.department || "" },
                              { label: "Academic Year", value: formatAcademicYear(app.data?.academic_year, "") },
                              { label: "Academic Year Type", value: toAcademicYearType(app.data?.academic_year_type) },
                              { label: "Category", value: app.data.course_category || "" },
                              { label: "Submitted At", value: app.created_at ? new Date(app.created_at).toLocaleString() : "" },
                              { label: "Approved Amount", value: getInstitutionCoordinatorApprovedAmount(app) }
                            ]
                              .filter((item) => hasDisplayText(item.value))
                              .map((item) => (
                                <div key={item.label}>
                                  <span className="text-black/50">{item.label}:</span> {item.value}
                                </div>
                              ))}
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={() => setSelectedApplication(app)}
                            >
                              View Form
                            </button>
                          </div>
                        </div>
                      ))}
                      {filteredApprovedByMeApps.length === 0 && (
                        <div className="muted text-sm">
                          {approvedSearch.trim()
                            ? "No approved applications match your search and filters."
                            : "No applications found for the selected filters."}
                        </div>
                      )}
                    </div>
                    {filteredApprovedByMeApps.length > 0 && (
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="muted text-sm">
                          Page {approvedPageData.currentPage} of {approvedPageData.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={approvedPageData.currentPage <= 1}
                            onClick={() => setApprovedPage((prev) => Math.max(1, prev - 1))}
                          >
                            Prev
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={approvedPageData.currentPage >= approvedPageData.totalPages}
                            onClick={() => setApprovedPage((prev) => Math.min(approvedPageData.totalPages, prev + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {active === "Total Applications" && (
                  <div className="mt-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold font-display">Total Applications</h2>
                      <div className="w-full sm:w-72">
                        <label className="text-xs uppercase tracking-[0.2em] text-black/40">Status Filter</label>
                        <select
                          className="input mt-2"
                          value={totalStatusFilter}
                          onChange={(e) => {
                            setTotalStatusFilter(e.target.value);
                            setTotalPage(1);
                          }}
                        >
                          <option value="all">All Applications</option>
                          <option value="approved">Approved Applications</option>
                          <option value="rejected">Rejected Applications</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 w-full lg:max-w-xl">
                      <label className="text-xs uppercase tracking-[0.2em] text-black/40">Search Total Applications</label>
                      <input
                        className="input mt-2"
                        type="search"
                        placeholder="Search by name, ID, department, status, course title"
                        value={totalSearch}
                        onChange={(e) => {
                          setTotalSearch(e.target.value);
                          setTotalPage(1);
                        }}
                      />
                    </div>
                    <div className="mt-4 grid gap-4">
                      {totalPageData.rows.map((app) => (
                        <div key={app.id} className="panel p-4">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold">{app.data.applicant_name || app.data.application_name || "-"}</div>
                            <span className="badge">{app.status}</span>
                          </div>
                          <div className="muted mt-2 text-xs">ID: {app.id}</div>
                          <div className="mt-3 text-sm text-black/70">
                            <span className="text-black/50">Department:</span> {app.data.department || "-"}
                          </div>
                          <div className="mt-2 text-sm text-black/70">
                            <span className="text-black/50">Submitted At:</span> {app.created_at ? new Date(app.created_at).toLocaleString() : "-"}
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={() => setSelectedApplication(app)}
                            >
                              View Form
                            </button>
                          </div>
                        </div>
                      ))}
                      {filteredTotalApps.length === 0 && (
                        <div className="muted text-sm">
                          {totalSearch.trim()
                            ? "No applications match your search and filter."
                            : "No applications."}
                        </div>
                      )}
                    </div>
                    {filteredTotalApps.length > 0 && (
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="muted text-sm">
                          Page {totalPageData.currentPage} of {totalPageData.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={totalPageData.currentPage <= 1}
                            onClick={() => setTotalPage((prev) => Math.max(1, prev - 1))}
                          >
                            Prev
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={totalPageData.currentPage >= totalPageData.totalPages}
                            onClick={() => setTotalPage((prev) => Math.min(totalPageData.totalPages, prev + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {active === "Reports" && user?.role === "institution_coordinator" && (
                  <div className="mt-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold font-display">Real-Time Reports Dashboard</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <button className="btn btn-ghost" type="button" onClick={refresh}>Refresh</button>
                        <button className="btn btn-ghost" type="button" onClick={exportReportPdf}>Export PDF</button>
                        <button className="btn btn-ghost" type="button" onClick={exportGraphPdf}>Graph PDF (A4)</button>
                      </div>
                    </div>

                    <div className="mt-4 panel p-4">
                      <div className="text-xs text-[color:var(--ink-soft)]">
                        All graphs and reports on one page. Auto-refresh updates every 5 seconds.
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="stat-card p-3 text-sm">
                          <div className="stat-card-label">Total Applications</div>
                          <div className="stat-card-value text-xl">{reportTotalCount}</div>
                        </div>
                        <div className="stat-card p-3 text-sm">
                          <div className="stat-card-label">Pending</div>
                          <div className="stat-card-value text-xl">{reportPendingCount}</div>
                        </div>
                        <div className="stat-card p-3 text-sm">
                          <div className="stat-card-label">Approved</div>
                          <div className="stat-card-value text-xl">{reportApprovedApps.length}</div>
                        </div>
                        <div className="stat-card p-3 text-sm">
                          <div className="stat-card-label">Approved Total (Rs)</div>
                          <div className="stat-card-value text-xl">{formatRs(reportApprovedTotalAmount)}</div>
                        </div>
                      </div>

                      <div ref={graphContainerRef} className="mt-6 space-y-6">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
                              Academic Year Filter
                            </label>
                            <select className="input" value={reportYearFilter} onChange={(e) => setReportYearFilter(e.target.value)}>
                              <option value="all">All Academic Years</option>
                              {yearWiseDropdownOptions.map((item) => (
                                <option key={item.year} value={item.year}>{item.year}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                          {renderPieCard("Application Status Pie Graph", reportBreakdown, statusPieSegments, reportTotalCount)}
                          {renderPieCard(
                            "Academic Year and Academic Year Type Wise Pie Graph",
                            academicYearData,
                            academicYearSegments,
                            academicYearTotal
                          )}
                          {renderPieCard(
                            "Department Wise Applications Pie Graph",
                            departmentWiseData,
                            departmentWiseSegments,
                            departmentWiseTotal,
                            "No department applications."
                          )}
                          {renderPieCard(
                            "Faculty vs Student Applications Pie Graph",
                            applicationTypeData,
                            applicationTypeSegments,
                            applicationTypeTotal,
                            "No application type data."
                          )}
                          {renderPieCard("Category Wise Pie Graph", categoryWiseData, categoryWiseSegments, categoryWiseTotal)}
                          {renderPieCard("Feedback Rating Pie Graph", feedbackData, feedbackSegments, feedbackTotal, "No feedback submissions yet.")}
                          {renderPieCard(`Last Year (${lastYear}) Pie Graph`, lastYearStatusData, lastYearSegments, lastYearTotal, `No applications in ${lastYear}`)}
                          {renderPieCard(`${selectedYearLabel} Status Pie Graph`, selectedYearStatusData, selectedYearStatusSegments, selectedYearStatusTotal)}
                        </div>

                        {renderMonthlyTrendCard()}
                        {renderYearWiseLineCard()}

                        <div className="overflow-x-auto">
                          <h3 className="mb-3 text-sm font-semibold text-[color:var(--ink)]">Year Wise Application Summary</h3>
                          <table className="data-table min-w-[860px]">
                            <thead>
                              <tr>
                                <th>Academic Year</th>
                                <th>Total</th>
                                <th>Pending</th>
                                <th>Approved</th>
                                <th>Rejected</th>
                                <th>Approved Rs</th>
                              </tr>
                            </thead>
                            <tbody>
                              {yearWiseSummary.map((row) => (
                                <tr key={row.year}>
                                  <td className="font-medium">{row.year}</td>
                                  <td>{row.total}</td>
                                  <td>{row.pending}</td>
                                  <td>{row.approved}</td>
                                  <td>{row.rejected}</td>
                                  <td>{formatRs(row.approvedAmount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {yearWiseSummary.length === 0 && (
                            <div className="mt-3 text-sm text-[color:var(--ink-soft)]">No academic year records available.</div>
                          )}
                        </div>
                      </div>


                      {reportNotice && (
                        <div className="mt-4 alert-info">{reportNotice}</div>
                      )}
                    </div>

                    <div
                      ref={allGraphsPdfRef}
                      aria-hidden="true"
                      className="pointer-events-none"
                      style={{
                        position: "fixed",
                        left: "-20000px",
                        top: 0,
                        width: "1240px",
                        padding: "24px",
                        background: "#ffffff",
                        zIndex: -1,
                        fontFamily: "\"Times New Roman\", Times, serif"
                      }}
                    >
                      <div className="space-y-4">
                        {reportGraphExportItems.map((item) => (
                          <section key={item.key} data-graph-export-card data-graph-title={item.title} className="w-full">
                            {renderSelectedReportGraph(item.key)}
                          </section>
                        ))}
                      </div>
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

                {active === "Authority Users" && user?.role === "institution_coordinator" && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xl font-semibold font-display">Authority Users</h2>
                      <div className="muted text-sm">
                        {activeAuthorityUsersCount} active, {inactiveAuthorityUsersCount} inactive
                      </div>
                    </div>
                    <div className="mt-3">
                      <input
                        className="input"
                        placeholder="Search authority users by name, email, department, or role"
                        value={authorityFilter}
                        onChange={(e) => {
                          setAuthorityFilter(e.target.value);
                          setAuthorityUsersPage(1);
                        }}
                      />
                    </div>
                    <div className="mt-4">
                      <div className="grid gap-3 sm:hidden">
                        {authorityUsersPageData.rows.map((u) => (
                          <div key={u.id} className="panel p-3">
                            {(() => {
                              const isActive = u?.is_active !== false;
                              return (
                                <>
                                  <div className="font-semibold">{u.name}</div>
                                  <div className="mt-1 text-xs text-black/60">{u.email}</div>
                                  <div className="mt-2 text-sm text-black/70">Department: {u.department}</div>
                                  <div className="text-sm text-black/70">Role: {AUTHORITY_ROLE_LABELS[u.role] || u.role}</div>
                                  <div className="text-sm text-black/70">
                                    Status:{" "}
                                    <span className={isActive ? "text-emerald-700 font-medium" : "text-rose-700 font-medium"}>
                                      {isActive ? "Active" : "Inactive"}
                                    </span>
                                  </div>
                                  <div className="mt-3">
                                    <button
                                      className={`btn btn-ghost w-full ${isActive ? "text-rose-600" : "text-emerald-700"}`}
                                      type="button"
                                      disabled={updatingAuthorityUserId === u.id}
                                      onClick={() => setAuthorityUserStatus(u, !isActive)}
                                    >
                                      {updatingAuthorityUserId === u.id
                                        ? "Updating..."
                                        : (isActive ? "Deactivate" : "Activate")}
                                    </button>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                      <div className="hidden overflow-x-auto sm:block">
                        <table className="w-full min-w-[920px] text-left text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-[0.2em] text-black/40">
                              <th className="py-2 pr-4">Full Name</th>
                              <th className="py-2 pr-4">Email</th>
                              <th className="py-2 pr-4">Department</th>
                              <th className="py-2 pr-4">Role</th>
                              <th className="py-2 pr-4">Status</th>
                              <th className="py-2 pr-4">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/10">
                            {authorityUsersPageData.rows.map((u) => (
                              <tr key={u.id}>
                                {(() => {
                                  const isActive = u?.is_active !== false;
                                  return (
                                    <>
                                      <td className="py-3 pr-4 font-medium">{u.name}</td>
                                      <td className="py-3 pr-4">{u.email}</td>
                                      <td className="py-3 pr-4">{u.department}</td>
                                      <td className="py-3 pr-4">{AUTHORITY_ROLE_LABELS[u.role] || u.role}</td>
                                      <td className="py-3 pr-4">
                                        <span className={isActive ? "text-emerald-700 font-medium" : "text-rose-700 font-medium"}>
                                          {isActive ? "Active" : "Inactive"}
                                        </span>
                                      </td>
                                      <td className="py-3 pr-4">
                                        <button
                                          className={`btn btn-ghost ${isActive ? "text-rose-600" : "text-emerald-700"}`}
                                          type="button"
                                          disabled={updatingAuthorityUserId === u.id}
                                          onClick={() => setAuthorityUserStatus(u, !isActive)}
                                        >
                                          {updatingAuthorityUserId === u.id
                                            ? "Updating..."
                                            : (isActive ? "Deactivate" : "Activate")}
                                        </button>
                                      </td>
                                    </>
                                  );
                                })()}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {filteredAuthorityUsers.length === 0 && <div className="muted mt-3 text-sm">No authority users found.</div>}
                      {filteredAuthorityUsers.length > 0 && (
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="muted text-sm">Page {authorityUsersPageData.currentPage} of {authorityUsersPageData.totalPages}</div>
                          <div className="flex items-center gap-2">
                            <button
                              className="btn btn-ghost"
                              type="button"
                              disabled={authorityUsersPageData.currentPage <= 1}
                              onClick={() => setAuthorityUsersPage((prev) => Math.max(1, prev - 1))}
                            >
                              Prev
                            </button>
                            <button
                              className="btn btn-ghost"
                              type="button"
                              disabled={authorityUsersPageData.currentPage >= authorityUsersPageData.totalPages}
                              onClick={() => setAuthorityUsersPage((prev) => Math.min(authorityUsersPageData.totalPages, prev + 1))}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                      {authorityUsersMessage.text && (
                        <div className={`mt-3 text-sm ${authorityUsersMessage.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
                          {authorityUsersMessage.text}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {active === "Form Filling Window" && user?.role === "institution_coordinator" && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold font-display">Form Filling Window</h2>
                      <div className="muted text-sm">Institution Coordinator Control</div>
                    </div>
                    <form onSubmit={submitFormWindow} className="mt-4 grid gap-3 md:grid-cols-3">
                      <input
                        className="input"
                        type="date"
                        value={formWindowForm.start_date}
                        onChange={(e) => setFormWindowForm((prev) => ({ ...prev, start_date: e.target.value }))}
                        required
                      />
                      <input
                        className="input"
                        type="date"
                        value={formWindowForm.end_date}
                        onChange={(e) => setFormWindowForm((prev) => ({ ...prev, end_date: e.target.value }))}
                        required
                      />
                      <div className="md:col-span-3 flex justify-end">
                        <button className="btn btn-primary w-full md:w-auto" type="submit">Save Window</button>
                      </div>
                    </form>
                    <div className="muted mt-3 text-sm">
                      Applications can be submitted only between selected start and end dates.
                    </div>
                    {formWindowMessage && <div className="mt-2 text-sm text-black/70">{formWindowMessage}</div>}
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
                      <div className="  panel p-4">
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
                      This deactivates your account access. Your records are retained in the database.
                    </p>
                    <div className="mt-4 panel border-rose-300/70 bg-rose-50 p-4">
                      <button
                        className="btn btn-primary bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
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
              </>
            )}
          </div>
        </div>
      </div>

      <DashboardMobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={menu}
        active={active}
        onSelect={handleSelect}
        user={user}
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
        hideEmptyFields
        onClose={() => setSelectedApplication(null)}
      />
    </div>
  );
}
