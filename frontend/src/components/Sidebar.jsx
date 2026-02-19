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
    <aside className="panel flex h-full min-h-0 flex-col p-4 md:p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-black/40">Navigation</div>
      <nav className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-medium transition ${
              active === item
                ? "bg-gradient-to-r from-[#10202c] to-[#2b6f8f] text-white shadow-[0_12px_24px_rgba(27,26,23,0.22)]"
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
