import { useEffect, useId } from "react";
import { getApprovedAmount } from "../lib/amount.js";
import { formatAcademicYear } from "../lib/academicYear.js";

const toText = (value, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const normalizeSearchText = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const getApplicantName = (app) =>
  toText(app?.data?.applicant_name || app?.data?.application_name || app?.data?.title || app?.data?.name);

export default function ApplicationDetailsPopup({ open, application, allApplications = [], onClose }) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !application) return null;

  const applicantName = getApplicantName(application);
  const applicantKey = normalizeSearchText(applicantName);
  const approvedTrackingRows = Array.isArray(allApplications)
    ? allApplications
        .filter((item) => normalizeSearchText(getApplicantName(item)) === applicantKey)
        .filter((item) => String(item?.status || "").toLowerCase() === "approved")
        .sort((a, b) => {
          const aTime = new Date(a?.created_at || 0).getTime();
          const bTime = new Date(b?.created_at || 0).getTime();
          return bTime - aTime;
        })
    : [];

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
        className="panel flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden bg-[color:var(--bg-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold text-[color:var(--primary-deep)]">
              Approved Tracking Records
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-black/55">
              Latest approved records for {applicantName || "this applicant"}.
            </p>
          </div>
          <button className="btn btn-ghost shrink-0" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white/80">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Applicant Name</th>
                  <th>Academic Year</th>
                  <th>Academic Type</th>
                  <th>Category</th>
                  <th>Approved Amt</th>
                </tr>
              </thead>
              <tbody>
                {approvedTrackingRows.map((row) => (
                  <tr key={row.id}>
                    <td>{toText(row.id)}</td>
                    <td>{getApplicantName(row)}</td>
                    <td>{formatAcademicYear(row?.data?.academic_year, "-")}</td>
                    <td>{toText(row?.data?.academic_year_type)}</td>
                    <td>{toText(row?.data?.course_category)}</td>
                    <td>{toText(getApprovedAmount(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
