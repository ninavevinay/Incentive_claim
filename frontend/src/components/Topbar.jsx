export default function Topbar({ title, subtitle }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="badge">Dashboard</div>
        <h1 className="mt-3 text-2xl font-semibold font-display sm:text-3xl">{title}</h1>
        <p className="muted mt-1 text-sm break-words">{subtitle}</p>
      </div>
      <div className="panel flex items-center gap-3 px-3 py-3 sm:px-4">
        <div className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-semibold">
          NP
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-black/40">Portal</div>
          <div className="text-sm font-semibold">Incentive Portal</div>
        </div>
      </div>
    </div>
  );
}
