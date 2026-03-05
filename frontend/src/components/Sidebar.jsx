function getInitials(name) {
  if (!name) return "SB";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SB";
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function formatRole(role) {
  if (!role) return "User";
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Sidebar({ items, active, onSelect, user, showToggle = false, onToggle }) {
  const initials = getInitials(user?.name);
  const roleLabel = formatRole(user?.role);
  return (
    <aside className="panel flex flex-col p-4 md:p-6">
      <div className="rounded-2xl border border-[#10202c]/15 bg-white/75 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#10202c] to-[#2b6f8f] text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#10202c]">{user?.name || "Portal Menu"}</div>
            <div className="text-xs uppercase tracking-[0.14em] text-black/50">{roleLabel}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.2em] text-black/40">Navigation</div>
        {showToggle && onToggle && (
          <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={onToggle}>
            Toggle
          </button>
        )}
      </div>

      <nav className="mt-4 space-y-2 pr-1">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-medium transition ${
              active === item
                ? "bg-gradient-to-r from-[#10202c] to-[#2b6f8f] text-white shadow-[0_12px_24px_rgba(27,26,23,0.22)] ring-1 ring-white/60"
                : "text-[#2a3a42] hover:bg-[#2b6f8f]/12"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="mt-6 rounded-2xl border border-[#10202c]/15 bg-white/75 p-4">
        <div className="text-sm font-semibold">Need help?</div>
        <p className="mt-1 text-xs text-black/60">Contact the incentives office for approval queries.</p>
        <a className="mt-1 inline-block text-xs text-[#2b6f8f] underline" href="mailto:incentiveinfo@sbjit.edu.in">
          incentiveinfo@sbjit.edu.in
        </a>
      </div>
    </aside>
  );
}
