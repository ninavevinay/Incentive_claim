import { useEffect, useId } from "react";
import { resolveMediaUrl } from "../lib/api.js";
import { getApprovedAmount } from "../lib/amount.js";
import { formatAcademicYear } from "../lib/academicYear.js";

const toText = (value, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toDateTimeText = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const hasValue = (value) => String(value ?? "").trim() !== "";

const hasMeaningfulValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  return text !== "-" && lowered !== "not provided" && lowered !== "n/a";
};

const toFileHref = (value) => {
  const path = String(value ?? "").trim();
  if (!path) return "";
  return path.startsWith("http") ? path : resolveMediaUrl(path);
};

const FieldGrid = ({ items }) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {items.map((item) => (
      <div key={item.label} className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-black/40">{item.label}</div>
        <div className="mt-1 break-words text-sm text-black/80">{item.value}</div>
      </div>
    ))}
  </div>
);

const Section = ({ number, title, subtitle, children }) => (
  <section className="rounded-3xl border border-black/10 bg-white/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-black/40">{number}</div>
        <h3 className="mt-1 text-lg font-semibold text-[color:var(--primary-deep)]">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-black/50">{subtitle}</p> : null}
      </div>
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const FileGrid = ({ items }) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {items.map((item) => {
      const href = toFileHref(item.path);
      return (
        <div key={item.label} className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-black/40">{item.label}</div>
          <div className="mt-1 text-sm text-black/80">
            {href ? (
              <a className="font-medium text-sky-700 underline" href={href} target="_blank" rel="noreferrer">
                View File
              </a>
            ) : (
              "-"
            )}
          </div>
        </div>
      );
    })}
  </div>
);

export default function ApplicationDetailsPopup({ open, application, hideEmptyFields = false, onClose }) {
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

  const data = application.data || {};
  const isStudent = String(application.application_type || "").toLowerCase() === "student";
  const summaryItems = [
    { label: "Application ID", value: toText(application.id) },
    { label: "Application Type", value: toText(application.application_type) },
    { label: "Status", value: toText(application.status) },
    { label: "Submitted On", value: toDateTimeText(application.created_at) },
    { label: "Approved Amount", value: toText(getApprovedAmount(application)) }
  ].filter((item) => !hideEmptyFields || hasMeaningfulValue(item.value));

  const applicantItems = [
    { label: "Applicant Name", value: toText(data.applicant_name || data.application_name || data.title) },
    { label: "Department", value: toText(data.department) },
    { label: "Email", value: toText(data.email) },
    { label: "Mobile Number", value: toText(data.mobile_number) },
    { label: "Academic Year", value: formatAcademicYear(data.academic_year, "") },
    { label: "Academic Year Type", value: toText(data.academic_year_type) }
  ].filter((item) => !hideEmptyFields || hasMeaningfulValue(item.value));

  if (isStudent) {
    applicantItems.push({ label: "USN", value: toText(data.usn) });
    applicantItems.push({ label: "Semester", value: toText(data.semester) });
  } else {
    applicantItems.push({ label: "Designation", value: toText(data.designation) });
  }

  const applicantVisibleItems = applicantItems.filter((item) => !hideEmptyFields || hasMeaningfulValue(item.value));

  const courseItems = [
    { label: "Course Category", value: toText(data.course_category) },
    { label: "Platform", value: toText(data.course_platform) },
    { label: "Title of Course", value: toText(data.course_title) },
    { label: "NPTEL Roll Number", value: toText(data.nptel_application_number) },
    { label: "Session", value: toText(data.course_session) },
    { label: "Number of Weeks", value: toText(data.course_weeks) },
    { label: "Score", value: toText(data.course_score) },
    { label: "Credits", value: toText(data.course_credits) }
  ].filter((item) => !hideEmptyFields || hasMeaningfulValue(item.value));

  const registrationItems = [
    { label: "Registration Fee Paid", value: toText(data.registration_fee_paid) },
    { label: "Permissible Claim", value: toText(data.permissible_claim) }
  ].filter((item) => !hideEmptyFields || hasMeaningfulValue(item.value));

  const bankItems = isStudent
    ? [
        { label: "Bank Account Number", value: toText(data.bank_account_number) },
        { label: "Bank Name", value: toText(data.bank_name) },
        { label: "Bank Branch", value: toText(data.bank_branch) },
        { label: "Bank IFSC", value: toText(data.bank_ifsc) }
      ].filter((item) => !hideEmptyFields || hasMeaningfulValue(item.value))
    : [];

  const documentItems = [
    { label: "Fee Receipt", path: data.fee_receipt_file },
    { label: "Certificate", path: data.certificate_file },
    ...(isStudent ? [{ label: "Bank Passbook", path: data.bank_passbook_file }] : []),
    { label: "Photograph", path: data.photograph_file },
    { label: "Signature", path: data.signature_file }
  ].filter((item) => hasValue(item.path));

  const hasCourseDetails = courseItems.length > 0;
  const hasRegistrationDetails = registrationItems.length > 0;
  const hasBankDetails = bankItems.length > 0;
  const hasDocumentDetails = documentItems.length > 0;

  const handleBackdropClick = () => onClose?.();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={handleBackdropClick}
    >
      <div
        className="panel flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden bg-[color:var(--bg-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-black/40">Application Details</div>
            <h2 id={titleId} className="mt-1 text-xl font-semibold text-[color:var(--primary-deep)]">
              Application #{application.id}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-black/55">
              Review the full submitted record and any uploaded files.
            </p>
          </div>
          <button className="btn btn-ghost shrink-0" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <Section number="1" title="Application Summary" subtitle="Status and approval snapshot">
            <FieldGrid items={summaryItems} />
          </Section>

          <Section number="2" title="Applicant Details" subtitle="Personal and academic information">
            <FieldGrid items={applicantVisibleItems} />
          </Section>

          {hasCourseDetails ? (
            <Section number="3" title="Course Details" subtitle="Certification information">
              <FieldGrid items={courseItems} />
            </Section>
          ) : null}

          {hasRegistrationDetails ? (
            <Section number="4" title="Registration Details" subtitle="Fee and claim information">
              <FieldGrid items={registrationItems} />
            </Section>
          ) : null}

          {hasBankDetails ? (
            <Section number="5" title="Bank Details" subtitle="Reimbursement account information">
              <FieldGrid items={bankItems} />
            </Section>
          ) : null}

          {hasDocumentDetails ? (
            <Section number="6" title="Documents" subtitle="Uploaded files">
              <FileGrid items={documentItems} />
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
