export default function Topbar({ title, subtitle }) {
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());

  return (
    <div className="animate-fade">
      <div className="section-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 lg:max-w-[70%]">
          <div className="badge">Claims Workspace</div>
          <h1 className="mt-3 text-2xl font-bold font-display text-[color:var(--primary-deep)] sm:text-3xl">{title}</h1>
          <p className="muted mt-1.5 text-sm break-words">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <div className="claim-pill items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Secure Session
          </div>
          <div className="claim-pill" style={{ borderColor: "rgba(234, 88, 12, 0.3)", background: "var(--accent-soft)", color: "var(--accent)" }}>
            <svg className="mr-1 h-3.5 w-3.5" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            {today}
          </div>
        </div>
      </div>
    </div>
  );
}
