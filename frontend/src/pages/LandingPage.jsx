import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, resolveMediaUrl } from "../lib/api.js";

const HERO_TITLE = "SBJIT NPTEL Reimburse";

const HERO_DESCRIPTION =
  "Apply for NPTEL and academic incentives with a single digital workflow for students, faculty, and departments";

const HERO_SLIDES = [
  {
    image: "/elearning/carousel-1.jpg",
    alt: "SBJIT academic campus and students",
    title: HERO_TITLE,
    description: HERO_DESCRIPTION,
  },
  {
    image: "/elearning/carousel-2.jpg",
    alt: "Institutional review and approval process",
    title: HERO_TITLE,
    description: HERO_DESCRIPTION,
  },
];

const SERVICE_ITEMS = [
  {
    title: "Role-Based Access",
    description:
      "Secure login and dashboards for student, faculty, authority, and admin users.",
  },
  {
    title: "Unified Workflow",
    description:
      "Single journey from form submission to department review and final approval.",
  },
  {
    title: "Verification Ready",
    description:
      "Structured data capture with document attachments for each incentive claim.",
  },
  {
    title: "Status Visibility",
    description:
      "Live tracking, notices, and downloadable records for complete transparency.",
  },
];

const ABOUT_POINTS = [
  "Centralized portal for academic incentive management",
  "Structured department and institution-level approval workflow",
  "Secure submission of applications and supporting documents",
  "Real-time status tracking and transparent validation process",
];

const WORKFLOW_STEPS = [
  "Applicant submits form with supporting documents",
  "Department Coordinator verifies details",
  "Department HOD reviews recommendation",
  "Institution Coordinator finalizes approval",
];

const formatNoticeDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
};

const getNoticeHref = (noticePath) => {
  const path = String(noticePath || "").trim();

  if (!path) return "#";

  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  return resolveMediaUrl(path);
};

export default function LandingPage() {
  const [notices, setNotices] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);

  const activeHeroSlide =
    HERO_SLIDES[activeSlide] || HERO_SLIDES[0];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide(
        (prev) => (prev + 1) % HERO_SLIDES.length
      );
    }, 5500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    api
      .publicNotices()
      .then((rows) => {
        if (mounted) {
          setNotices(
            Array.isArray(rows)
              ? rows.slice(0, 5)
              : []
          );
        }
      })
      .catch(() => {
        if (mounted) {
          setNotices([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const goToSlide = (index) => {
    const size = HERO_SLIDES.length;

    setActiveSlide((index + size) % size);
  };

  const goToPreviousSlide = () =>
    goToSlide(activeSlide - 1);

  const goToNextSlide = () =>
    goToSlide(activeSlide + 1);

  return (
    <div className="landing-page template-landing">
      {/* HERO SECTION */}
      <section
        id="home"
        className="landing-hero-full tpl-hero"
      >
        <div className="tpl-carousel">
          <article
            key={`${activeSlide}-${activeHeroSlide.title}`}
            className="tpl-slide is-active"
            aria-live="polite"
          >
            <img
              src={activeHeroSlide.image}
              alt={activeHeroSlide.alt}
              loading={
                activeSlide === 0
                  ? "eager"
                  : "lazy"
              }
            />

            <div className="tpl-slide-overlay" />

            <div className="tpl-slide-inner tpl-hero-inner px-3 sm:px-4 md:px-8 lg:px-10">
              <div className="tpl-slide-panel">
                <div className="tpl-slide-copy">
                  <h1 className="tpl-hero-title text-white">
                    {activeHeroSlide.title}
                  </h1>

                  <p className="tpl-hero-description text-white">
                    {activeHeroSlide.description}
                  </p>

                  <div className="tpl-slide-actions">
                    <Link
                      className="btn btn-primary tpl-btn-main"
                      to="/login"
                    >
                      Login
                    </Link>

                    <Link
                      className="btn tpl-btn-light"
                      to="/register"
                    >
                      Create Account
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <button
            type="button"
            className="tpl-nav-btn tpl-nav-prev"
            onClick={goToPreviousSlide}
            aria-label="Previous slide"
          >
            {"<"}
          </button>

          <button
            type="button"
            className="tpl-nav-btn tpl-nav-next"
            onClick={goToNextSlide}
            aria-label="Next slide"
          >
            {">"}
          </button>

          <div
            className="tpl-dots"
            aria-label="Hero slide selectors"
          >
            {HERO_SLIDES.map((slide, index) => (
              <button
                type="button"
                key={`${slide.image}-${index}`}
                className={`tpl-dot ${
                  index === activeSlide
                    ? "is-active"
                    : ""
                }`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${
                  index + 1
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <div className="tpl-full-width-content px-3 sm:px-4 md:px-8 lg:px-10">
        {/* SERVICES */}
        <section className="tpl-services-section">
          <div className="tpl-section-head">
            <div className="tpl-section-title">
              Portal Highlights
            </div>

            <h2>
              Everything Needed for Incentive
              Processing
            </h2>
          </div>

          <div className="tpl-services-grid">
            {SERVICE_ITEMS.map((item) => (
              <article
                key={item.title}
                className="tpl-service-card"
              >
                <h3>{item.title}</h3>

                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ABOUT */}
        <section
          id="about"
          className="tpl-about-section"
        >
          <div className="tpl-about-media">
            <img
              src="/elearning/about.jpg"
              alt="Academic campus overview"
              loading="lazy"
            />
          </div>

          <div className="tpl-about-copy">
            <div className="tpl-section-title text-start">
              About Portal
            </div>

            <h2>
              Built for Fast, Reliable, and
              Transparent Approvals
            </h2>

            <p>
              SBJIT NPTEL Reimburse is a centralized digital platform designed to streamline academic incentive applications, verification, and approvals through a transparent multi-level workflow. It enables applicants, department coordinators, HODs, and institution authorities to manage the entire process efficiently from submission to final approval.
            </p>

            <ul>
              {ABOUT_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="tpl-workflow-section">
          <div className="tpl-section-head">
            <div className="tpl-section-title">
              Approval Workflow
            </div>

            <h2>
              From Applicant to Final Approval
            </h2>
          </div>

          <div className="tpl-workflow-grid">
            {WORKFLOW_STEPS.map(
              (step, index) => (
                <article
                  key={step}
                  className="tpl-workflow-step"
                >
                  <div className="tpl-workflow-number">
                    {index + 1}
                  </div>

                  <p>{step}</p>
                </article>
              )
            )}
          </div>
        </section>

        {/* NOTICE */}
        <section
          id="notice"
          className="card p-[20px] mb-8 md:mb-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 tpl-notice-head">
            <div>
              <div className="tpl-section-title">
                Public Notices
              </div>

              <h2 className="text-xl font-semibold font-display text-[color:var(--primary-deep)]">
                Latest Institute Updates
              </h2>

              <p className="muted mt-1 text-sm">
                Important announcements
                from the institute.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/80 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-[color:var(--text-primary)]">
                    {notice.title}
                  </div>

                  <div className="text-xs text-black/50">
                    {formatNoticeDate(
                      notice.created_at
                    )}
                  </div>
                </div>

                <a
                  className="mt-2 inline-block text-sm font-medium text-[color:var(--primary-deep)] underline"
                  href={getNoticeHref(
                    notice.file_path
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Notice
                </a>
              </div>
            ))}

            {notices.length === 0 && (
              <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/80 p-4 text-sm text-black/60">
                No notices published yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
