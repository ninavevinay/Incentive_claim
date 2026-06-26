export const COURSE_CATEGORY_OPTIONS = [
  "Elite",
  "Elite + Silver",
  "Elite + Gold",
  "Elite + Silver + Top 5%",
  "Elite + Silver + Top 2%",
  "Elite + Silver + Top 1%",
  "Elite + Gold + Top 5%",
  "Elite + Gold + Top 2%",
  "Elite + Gold + Top 1%",
  "NPTEL Super Star",
  "NPTEL Discipline Star",
  "NPTEL Domain Scholar",
  "NPTEL Believer",
  "NPTEL Enthusiast",
  "NPTEL Motivated Learner",
  "NPTEL Evangelist",
  "NPTEL MEGASTARS",
  "NPTEL CHAMPIONS",
];

export const NPTEL_STAR_CATEGORY_OPTIONS = [
  "NPTEL Super Star",
  "NPTEL Discipline Star",
  "NPTEL Domain Scholar",
  "NPTEL Believer",
  "NPTEL Enthusiast",
  "NPTEL Motivated Learner",
  "NPTEL Evangelist",
  "NPTEL MEGASTARS",
  "NPTEL CHAMPIONS"
];

export const normalizeCourseCategory = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const COURSE_CATEGORY_KEYS = new Set(COURSE_CATEGORY_OPTIONS.map((option) => normalizeCourseCategory(option)));
const NPTEL_STAR_CATEGORY_KEYS = new Set(
  NPTEL_STAR_CATEGORY_OPTIONS.map((option) => normalizeCourseCategory(option))
);

export const isNptelStarCategory = (courseCategory) =>
  NPTEL_STAR_CATEGORY_KEYS.has(normalizeCourseCategory(courseCategory));

export const shouldShowCourseDetails = (courseCategory) => {
  const normalized = normalizeCourseCategory(courseCategory);
  return COURSE_CATEGORY_KEYS.has(normalized) && !NPTEL_STAR_CATEGORY_KEYS.has(normalized);
};

export const shouldShowRegistrationDetails = shouldShowCourseDetails;

export const shouldShowCourseSections = shouldShowCourseDetails;
