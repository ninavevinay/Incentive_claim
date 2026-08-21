import { useEffect, useId, useMemo, useState } from "react";
import { getApprovedAmount } from "../lib/amount.js";
import { formatAcademicYear } from "../lib/academicYear.js";

const toText = (value, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const normalizeSearchText = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const getApplicantName = (app) =>
  toText(app?.data?.applicant_name || app?.data?.application_name || app?.data?.title || app?.data?.name);

const statusLabel = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "pending_department_coordinator":
      return "Dept Coordinator Pending";
    case "pending_department_hod":
      return "Dept HOD Pending";
    case "pending_institution_coordinator":
      return "Institute Coordinator Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status ? String(status).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "-";
  }
};

const statusBadgeStyle = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return { background: "rgba(16, 185, 129, 0.15)", color: "#065f46", border: "1px solid rgba(16, 185, 129, 0.3)" };
    case "rejected":
      return { background: "rgba(239, 68, 68, 0.15)", color: "#991b1b", border: "1px solid rgba(239, 68, 68, 0.3)" };
    case "pending_department_coordinator":
      return { background: "rgba(14, 165, 233, 0.15)", color: "#0369a1", border: "1px solid rgba(14, 165, 233, 0.3)" };
    case "pending_department_hod":
      return { background: "rgba(99, 102, 241, 0.15)", color: "#4338ca", border: "1px solid rgba(99, 102, 241, 0.3)" };
    case "pending_institution_coordinator":
      return { background: "rgba(245, 158, 11, 0.15)", color: "#92400e", border: "1px solid rgba(245, 158, 11, 0.3)" };
    default:
      return { background: "rgba(100, 116, 139, 0.15)", color: "#334155", border: "1px solid rgba(100, 116, 139, 0.3)" };
  }
};

export default function ApplicationDetailsPopup({ open, application, allApplications = [], onClose }) {
  const titleId = useId();
  const descriptionId = useId();
  const [filterTab, setFilterTab] = useState("all");

  useEffect(() => {
    if (!open) return undefined;
    setFilterTab("all");
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const applicantName = getApplicantName(application);
  const applicantEmail = String(application?.data?.email || application?.owner?.email || "").trim().toLowerCase();
  const applicantUsn = String(application?.data?.usn || "").trim().toUpperCase();
  const currentAppSem = String(application?.data?.semester || "").trim().toUpperCase();
  const currentAppYear = String(application?.data?.academic_year || "").trim();

  // Match all applications belonging to this applicant
  const applicantAllRows = useMemo(() => {
    if (!open || !application) return [];
    if (!Array.isArray(allApplications) || allApplications.length === 0) {
      return [application];
    }
    const filtered = allApplications.filter((item) => {
      if (!item) return false;
      if (item.id === application.id) return true;
      if (applicantEmail && String(item?.data?.email || item?.owner?.email || "").trim().toLowerCase() === applicantEmail) {
        return true;
      }
      if (applicantUsn && String(item?.data?.usn || "").trim().toUpperCase() === applicantUsn) {
        return true;
      }
      if (applicantName && normalizeSearchText(getApplicantName(item)) === normalizeSearchText(applicantName)) {
        return true;
      }
      return false;
    });

    // Ensure the clicked application is included if not already present
    if (!filtered.some((item) => item.id === application.id)) {
      filtered.push(application);
    }

    return filtered.sort((a, b) => {
      const aTime = new Date(a?.created_at || 0).getTime();
      const bTime = new Date(b?.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [open, application, allApplications, applicantEmail, applicantUsn, applicantName]);

  if (!open || !application) return null;

  const sameSemesterRows = applicantAllRows.filter((item) => {
    const sem = String(item?.data?.semester || "").trim().toUpperCase();
    return currentAppSem && sem === currentAppSem;
  });

  const approvedRows = applicantAllRows.filter((item) => String(item?.status || "").toLowerCase() === "approved");
  const pendingRows = applicantAllRows.filter((item) => String(item?.status || "").toLowerCase() !== "approved" && String(item?.status || "").toLowerCase() !== "rejected");

  const displayedRows = (() => {
    if (filterTab === "same_sem") return sameSemesterRows;
    if (filterTab === "approved") return approvedRows;
    if (filterTab === "pending") return pendingRows;
    return applicantAllRows;
  })();

  const hasMultipleInSameSem = sameSemesterRows.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={() => onClose?.()}
    >
      <div
        className="panel flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden bg-[color:var(--bg-surface)] shadow-2xl rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id={titleId} className="text-xl font-bold font-display text-[color:var(--primary-deep)]">
                Application Tracking Records
              </h2>
              <span className="badge font-mono text-xs">ID #{application.id}</span>
            </div>
            <p id={descriptionId} className="mt-1 text-sm text-black/60">
              Track all application and claim history for <strong className="text-black/80">{applicantName}</strong>
              {applicantUsn ? ` (USN: ${applicantUsn})` : ""}
              {currentAppSem ? ` • Semester: ${currentAppSem}` : ""}
            </p>
          </div>
          <button className="btn btn-ghost shrink-0" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-black/5 overflow-x-auto text-xs">
          <button
            type="button"
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${filterTab === "all"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            onClick={() => setFilterTab("all")}
          >
            All Applications ({applicantAllRows.length})
          </button>
          {hasMultipleInSameSem && (
            <button
              type="button"
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${filterTab === "same_sem"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                }`}
              onClick={() => setFilterTab("same_sem")}
            >
              Same Semester ({sameSemesterRows.length})
            </button>
          )}
          <button
            type="button"
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${filterTab === "approved"
                ? "bg-emerald-600 text-white font-semibold"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            onClick={() => setFilterTab("approved")}
          >
            Approved ({approvedRows.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${filterTab === "pending"
                ? "bg-amber-600 text-white font-semibold"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            onClick={() => setFilterTab("pending")}
          >
            In Review / Pending ({pendingRows.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
            <table className="data-table min-w-[1000px] w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-black/10 text-slate-700 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">App ID</th>
                  <th className="py-2.5 px-3">Semester</th>
                  <th className="py-2.5 px-3">Claim #</th>
                  <th className="py-2.5 px-3">Course / Subject</th>
                  <th className="py-2.5 px-3">Academic Year</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Approved Amt</th>
                  <th className="py-2.5 px-3">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {displayedRows.map((row) => {
                  const isCurrent = row.id === application.id;
                  const sem = toText(row?.data?.semester);
                  const isSameSemAsCurrent = currentAppSem && sem.toUpperCase() === currentAppSem;
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 transition-colors ${isCurrent ? "bg-indigo-50/40 font-medium" : ""
                        }`}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800">#{row.id}</span>
                        {isCurrent && (
                          <span className="ml-1.5 inline-block rounded bg-indigo-100 text-indigo-700 px-1.5 py-0.5 text-[10px] font-semibold">
                            Viewing
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 font-semibold ${isSameSemAsCurrent ? "text-indigo-600 font-bold" : "text-slate-700"}`}>
                          Sem {sem}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-slate-600 font-medium">
                          Claim {toText(row?.data?.incentive_claim_count, "1")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[220px] truncate" title={toText(row?.data?.course_title)}>
                        <span className="font-medium text-slate-800">
                          {toText(row?.data?.course_title || row?.data?.course_category)}
                        </span>
                        {row?.data?.nptel_application_number && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            NPTEL: {row.data.nptel_application_number}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {formatAcademicYear(row?.data?.academic_year, "-")} ({toText(row?.data?.academic_year_type)})
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {toText(row?.data?.course_category)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-xs"
                          style={statusBadgeStyle(row.status)}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-semibold">
                        {row.approved_amount != null && row.approved_amount > 0 ? (
                          <span className="text-emerald-700 font-bold">Rs. {Number(row.approved_amount).toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">{toText(getApprovedAmount(row))}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                      </td>
                    </tr>
                  );
                })}
                {displayedRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No matching application records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
