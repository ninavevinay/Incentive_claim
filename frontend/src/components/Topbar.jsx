export default function Topbar({ title, subtitle }) {
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());

  return (
    <div className="lg:sticky lg:top-0 lg:z-20">
      <div className="panel flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 lg:max-w-[70%]">
          <div className="badge">Claims Workspace</div>
          <h1 className="mt-3 text-2xl font-semibold font-display text-[#10202c] sm:text-3xl">{title}</h1>
          <p className="muted mt-1 text-sm break-words">{subtitle}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:w-auto">
          <div className="claim-pill justify-center">Secure Session</div>
          <div className="claim-pill justify-center">{today}</div>
        </div>
      </div>
    </div>
  );
}
