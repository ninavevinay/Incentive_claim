import { getApprovedAmount } from "./amount.js";
import { formatAcademicYear } from "./academicYear.js";
import { resolveMediaUrl } from "./api.js";
import { drawPdfHeader, getPdfHeaderImageDataUrl } from "./pdfHeader.js";

const HEADER_COLOR = [31, 41, 55];
const BORDER_COLOR = [209, 213, 219];
const STRIPE_COLOR = [249, 250, 251];
const TEXT_COLOR = [17, 24, 39];
const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read signature image."));
    reader.readAsDataURL(blob);
  });

const loadSignatureImage = async (signatureFilePath) => {
  const path = String(signatureFilePath ?? "").trim();
  if (!path) return null;

  const signatureUrl = resolveMediaUrl(path);
  if (!signatureUrl) return null;

  try {
    const response = await fetch(signatureUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const mimeType = String(blob.type || response.headers.get("content-type") || "").toLowerCase();
    if (!mimeType.startsWith("image/")) return null;
    const dataUrl = await blobToDataUrl(blob);
    return {
      dataUrl,
      format: mimeType.includes("png") ? "PNG" : "JPEG"
    };
  } catch {
    return null;
  }
};

const toText = (value, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toBooleanText = (value) => (value ? "Yes" : "No");

const toDateTimeText = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const toMoneyText = (value) => {
  if (value === null || value === undefined) return "-";
  const rawText = String(value).trim();
  if (!rawText) return "-";
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return toText(value);
  return numberValue.toFixed(2);
};

const isPrintableValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  return text !== "-" && lowered !== "not provided" && lowered !== "n/a";
};

const filterPrintableRows = (rows) =>
  rows.filter((row) => Array.isArray(row) && row.length >= 2 && isPrintableValue(row[1]));

const ensurePageSpace = (doc, cursorY, requiredSpace, drawPageHeader) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomPadding = 56;
  if (cursorY + requiredSpace <= pageHeight - bottomPadding) {
    return cursorY;
  }
  doc.addPage();
  return drawPageHeader();
};

const drawSectionTitle = (doc, title, cursorY, margin, pageWidth) => {
  const barHeight = 18;
  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.8);
  doc.rect(margin, cursorY, pageWidth - (margin * 2), barHeight, "FD");
  doc.setTextColor(...HEADER_COLOR);
  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.text(title, margin + 6, cursorY + 12);
  return cursorY + barHeight + 3;
};

const drawTwoColumnTable = (doc, autoTable, rows, cursorY, margin, pageWidth) => {
  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    body: rows,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9.2,
      cellPadding: 4,
      lineColor: BORDER_COLOR,
      lineWidth: 0.6,
      textColor: TEXT_COLOR,
      overflow: "linebreak",
      valign: "middle"
    },
    alternateRowStyles: { fillColor: STRIPE_COLOR },
    columnStyles: {
      0: { cellWidth: 195, fontStyle: "bold" },
      1: { cellWidth: pageWidth - (margin * 2) - 195 }
    }
  });
  return (doc.lastAutoTable?.finalY || cursorY) + 12;
};

const drawDeclarationBlock = (doc, cursorY, margin, pageWidth, accepted) => {
  const declarationLines = [
    "1. Credits earned by me shall be assigned to the Institute.",
    "2. If any excess payment made to me is noticed later, I will pay back the same.",
    "3. The information furnished by me is true and correct to the best of my knowledge."
  ];

  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.8);
  const boxHeight = 66;
  doc.rect(margin, cursorY, pageWidth - (margin * 2), boxHeight);

  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("times", "normal");
  doc.setFontSize(9.2);

  let lineY = cursorY + 14;
  declarationLines.forEach((line) => {
    doc.text(line, margin + 6, lineY);
    lineY += 16;
  });

  doc.setFont("times", "bold");
  doc.text(`Declaration Accepted: ${toBooleanText(accepted)}`, margin + 6, cursorY + boxHeight - 8);

  return cursorY + boxHeight + 16;
};

const drawApplicantSignatureBlock = (doc, cursorY, margin, signatureImage) => {
  const boxWidth = 220;
  const boxHeight = 72;
  const boxX = margin;
  const boxY = cursorY + 2;
  const padding = 6;

  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.9);
  doc.rect(boxX, boxY, boxWidth, boxHeight);

  if (signatureImage?.dataUrl) {
    const maxWidth = boxWidth - (padding * 2);
    const maxHeight = boxHeight - (padding * 2);
    let drawWidth = maxWidth;
    let drawHeight = maxHeight;

    try {
      const imageProps = doc.getImageProperties(signatureImage.dataUrl);
      if (imageProps?.width && imageProps?.height) {
        const scale = Math.min(maxWidth / imageProps.width, maxHeight / imageProps.height);
        drawWidth = imageProps.width * scale;
        drawHeight = imageProps.height * scale;
      }
    } catch {
      // Keep default draw dimensions when image properties cannot be resolved.
    }

    const drawX = boxX + padding + ((maxWidth - drawWidth) / 2);
    const drawY = boxY + padding + ((maxHeight - drawHeight) / 2);
    doc.addImage(signatureImage.dataUrl, signatureImage.format, drawX, drawY, drawWidth, drawHeight, undefined, "FAST");
  } else {
    const lineY = boxY + boxHeight - 16;
    doc.line(boxX + 10, lineY, boxX + boxWidth - 10, lineY);
  }

  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text("Signature of Applicant", boxX, boxY + boxHeight + 14);

  return boxY + boxHeight + 22;
};

const buildApplicantRows = (app, data) => {
  const isStudent = app?.application_type === "student";

  const rows = [
    ["Academic Year", formatAcademicYear(data?.academic_year, "-")],
    ["Academic Year Type (ODD / EVEN)", toText(data?.academic_year_type)],
    ["Department", toText(data?.department)],
    ["Applicant Name (Surname First)", toText(data?.applicant_name)],
    ["Mobile No.", toText(data?.mobile_number)],
    ["Email Id", toText(data?.email)]
  ];

  if (isStudent) {
    rows.splice(4, 0, ["USN", toText(data?.usn)]);
    rows.push(["Student - Semester", toText(data?.semester)]);
  } else {
    rows.push(["Designation", toText(data?.designation)]);
  }

  rows.push([
    "No. of times incentive is claimed under current academic year",
    toText(data?.incentive_claim_count)
  ]);

  return filterPrintableRows(rows);
};

const buildCourseRows = (data) =>
  filterPrintableRows([
    ["Platform", toText(data?.course_platform)],
    ["Title of Course", toText(data?.course_title)],
    ["NPTEL Application Number", toText(data?.nptel_application_number)],
    ["Session", toText(data?.course_session)],
    ["Number of Weeks", toText(data?.course_weeks)],
    ["Score (%)", toText(data?.course_score)],
    ["Category", toText(data?.course_category)],
    ["Credits", toText(data?.course_credits)]
  ]);

const buildFinancialRows = (app, data) =>
  filterPrintableRows([
    ["Registration Fee paid for Certification Course (Rs)", toMoneyText(data?.registration_fee_paid)],
    ["Permissible Claim as per policy (Rs)", toMoneyText(data?.permissible_claim)],
    ["Approved Amount (Rs)", toText(getApprovedAmount(app))]
  ]);

const buildBankRows = (data) =>
  filterPrintableRows([
    ["Bank Account Number", toText(data?.bank_account_number)],
    ["Bank Name", toText(data?.bank_name)],
    ["Bank Branch", toText(data?.bank_branch)],
    ["Bank IFSC", toText(data?.bank_ifsc)]
  ]);

const OFFICE_USE_ROLES = [
  "Department Coordinator",
  "Department HOD",
  "Institution Coordinator"
];

const buildOfficeUseRows = () =>
  OFFICE_USE_ROLES.map((role) => [role, "", "", ""]);

const drawOfficeUseTable = (doc, autoTable, rows, cursorY, margin) => {
  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    head: [["Role", "Action", "Remark", "Sign"]],
    body: rows,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 8.8,
      cellPadding: 4,
      lineColor: BORDER_COLOR,
      lineWidth: 0.6,
      textColor: TEXT_COLOR,
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 28
    },
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold"
    },
    alternateRowStyles: { fillColor: STRIPE_COLOR },
    columnStyles: {
      0: { cellWidth: 170, fontStyle: "bold" },
      1: { cellWidth: 120 },
      2: { cellWidth: 140 },
      3: { cellWidth: 101, halign: "center" }
    }
  });

  return (doc.lastAutoTable?.finalY || cursorY) + 12;
};

export const exportApplicationFormPdf = async (app) => {
  const data = app?.data || {};
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule.autoTable;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 32;
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerImageDataUrl = await getPdfHeaderImageDataUrl().catch(() => null);
  const signatureImage = await loadSignatureImage(data?.signature_file);
  let headerRenderCount = 0;

  const drawPageHeader = () => {
    const isFirstPage = headerRenderCount === 0;
    headerRenderCount += 1;
    return drawPdfHeader(doc, {
      margin,
      title: "INCENTIVE FORM FOR CERTIFICATION COURSES",
      headerImageDataUrl,
      titleAlign: isFirstPage ? "center" : "left",
      topPadding: isFirstPage ? 28 : 18
    });
  };

  let cursorY = drawPageHeader();
  let sectionNumber = 1;

  const drawSimpleSection = (title, rows, requiredSpace = 150) => {
    if (!rows || rows.length === 0) return false;
    cursorY = ensurePageSpace(doc, cursorY, requiredSpace, drawPageHeader);
    cursorY = drawSectionTitle(doc, `${sectionNumber}. ${title}`, cursorY, margin, pageWidth);
    cursorY = drawTwoColumnTable(doc, autoTable, rows, cursorY, margin, pageWidth);
    sectionNumber += 1;
    return true;
  };

  drawSimpleSection("Applicant's Details", buildApplicantRows(app, data), 140);
  drawSimpleSection("Course Details", buildCourseRows(data), 150);
  drawSimpleSection("Financial Details", buildFinancialRows(app, data), 130);

  if (app?.application_type === "student") {
    drawSimpleSection("Bank Details", buildBankRows(data), 130);
  }

  cursorY = ensurePageSpace(doc, cursorY, 130, drawPageHeader);
  cursorY = drawSectionTitle(doc, `${sectionNumber}. Declaration`, cursorY, margin, pageWidth);
  cursorY = drawDeclarationBlock(doc, cursorY, margin, pageWidth, data?.declaration_accepted);
  sectionNumber += 1;

  cursorY = ensurePageSpace(doc, cursorY, 130, drawPageHeader);
  cursorY = drawSectionTitle(doc, `${sectionNumber}. Applicant Signature`, cursorY, margin, pageWidth);
  cursorY = drawApplicantSignatureBlock(doc, cursorY, margin, signatureImage);
  sectionNumber += 1;

  cursorY = ensurePageSpace(doc, cursorY, 150, drawPageHeader);
  cursorY = drawSectionTitle(doc, `${sectionNumber}. Office Use`, cursorY, margin, pageWidth);
  cursorY = drawOfficeUseTable(doc, autoTable, buildOfficeUseRows(), cursorY, margin);

  doc.save(`application-form-${app?.id || "applicant"}.pdf`);
};
