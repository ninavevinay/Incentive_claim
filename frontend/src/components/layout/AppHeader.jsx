export default function AppHeader({ isDashboardRoute, mobileNavOpen, onToggleMobileMenu }) {
  return (
    <header className="sticky top-0 z-30 glass app-chrome border-b border-[color:var(--border-subtle)] py-3">
      <div className="app-container">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative group">
              <div
                className="absolute -inset-1 rounded-full blur-md opacity-35 transition-opacity group-hover:opacity-55"
                style={{ background: "linear-gradient(90deg, var(--primary), var(--accent))" }}
              ></div>
              <img
                src="/logo.jpg"
                alt="SB Jain Institute"
                className="relative h-11 w-11 rounded-full border-2 border-white bg-white object-contain shadow-lg sm:h-12 sm:w-12"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--primary)] sm:text-[11px]">
                S.B. Jain Institute
              </div>
              <div className="truncate text-sm font-semibold text-[color:var(--primary-deep)] sm:text-base md:text-lg font-display">
                Technology Management &amp; Research
              </div>
            </div>
          </div>

          {isDashboardRoute && (
            <button
              type="button"
              className="rounded-xl border border-[color:var(--border-subtle)] bg-white/80 p-2.5 text-[color:var(--primary)] transition-all hover:bg-white hover:text-[color:var(--primary-deep)] hover:shadow-md lg:hidden"
              onClick={onToggleMobileMenu}
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <div
            className="hidden items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] px-4 py-2 sm:flex"
            style={{ background: "linear-gradient(90deg, rgba(15, 118, 110, 0.12), rgba(234, 88, 12, 0.12))" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--primary-deep)]">
              Incentive Portal
            </span>
          </div>
        </div>

        {mobileNavOpen && !isDashboardRoute && (
          <div className="mt-3 rounded-xl border border-[color:var(--border-subtle)] bg-white/95 px-4 py-3 backdrop-blur-xl sm:hidden animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--primary-deep)]">
                Incentive Portal
              </span>
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
