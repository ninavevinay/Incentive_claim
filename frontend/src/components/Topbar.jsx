export default function Topbar({ title, subtitle }) {
  return (
    <div className="md:sticky md:top-0 md:z-20">
      <div className="panel flex flex-col gap-2 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="badge">Dashboard</div>
          <h1 className="mt-3 text-2xl font-semibold font-display text-[#10202c] sm:text-3xl">{title}</h1>
          <p className="muted mt-1 text-sm break-words">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
