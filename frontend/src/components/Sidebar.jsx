export default function Sidebar({ items, active, onSelect }) {
  return (
    <aside className="panel flex h-full min-h-0 flex-col p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-black/40">Portal</div>
          <div className="text-xl font-semibold font-display">Incentive Portal</div>
        </div>
        <div className="badge">NP</div>
      </div>
      <div className="mt-6 rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-black/40">Navigation</div>
        <div className="mt-2 text-sm text-black/70">Manage applications and updates.</div>
      </div>
      <nav className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-medium transition ${
              active === item ? "bg-black text-white shadow-[0_12px_24px_rgba(15,18,33,0.25)]" : "hover:bg-black/5"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="mt-6 rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="text-sm font-semibold">Need help?</div>
        <p className="mt-1 text-xs text-black/60">Contact the incentives office for approval queries.</p>
      </div>
    </aside>
  );
}
