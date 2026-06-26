const ACADEMIC_YEAR_PATTERN = /^\s*(\d{4})\s*[-/\u2013\u2014]\s*(\d{4})\s*$/;

const collapseAcademicYearText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const normalizeAcademicYear = (value) => {
  const text = collapseAcademicYearText(value);
  if (!text) return "";
  const match = text.match(ACADEMIC_YEAR_PATTERN);
  if (!match) return text;
  return `${match[1]} - ${match[2]}`;
};

export const isAcademicYearFormat = (value) => ACADEMIC_YEAR_PATTERN.test(collapseAcademicYearText(value));

export const formatAcademicYear = (value, fallback = "-") => {
  const normalized = normalizeAcademicYear(value);
  return isAcademicYearFormat(normalized) ? normalized : fallback;
};
