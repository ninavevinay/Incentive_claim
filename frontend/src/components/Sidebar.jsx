import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Bell,
  MessageSquare,
  User,
  Trash2,
  LogOut,
  Clock,
  CheckCircle2,
  List,
  BarChart3,
  Megaphone,
  UserPlus,
  Shield,
  Users,
  LogIn,
  Star,
  FolderOpen,
  Calendar,
  Circle,
  Search
} from "lucide-react";

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

const ICONS = {
  "Application Form": FileText,
  "My Applications": ClipboardList,
  "Application Track": ClipboardList,
  Notifications: Bell,
  Feedback: MessageSquare,
  Profile: User,
  "Delete Account": Trash2,
  Logout: LogOut,
  Overview: LayoutDashboard,
  "Pending Applications": Clock,
  "My Approved Applications": CheckCircle2,
  "Total Applications": List,
  Reports: BarChart3,
  Notice: Megaphone,
  "Register Authority": UserPlus,
  "Authority Users": Shield,
  "Registered Users": Users,
  "Login Events": LogIn,
  "User Feedback": Star,
  "All Applications": FolderOpen,
  "Form Filling Window": Calendar,
  "Approved Students": Search
};

function getIcon(item) {
  return ICONS[item] || Circle;
}

export default function Sidebar({ items, active, onSelect, user, showToggle = false, onToggle }) {
  const initials = getInitials(user?.name);
  const roleLabel = formatRole(user?.role);

  return (
    <aside className="portal-sidebar">
      <div className="shrink-0 border-b border-[color:var(--sidebar-border)] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--sidebar-active)] text-sm font-bold text-[color:var(--primary)]">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[color:var(--ink)]">{user?.name || "Portal User"}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--primary-soft)]">{roleLabel}</div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-4 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--sidebar-text-muted)]">Menu</div>
        {showToggle && onToggle && (
          <button type="button" className="text-[10px] font-medium text-[color:var(--primary-soft)]" onClick={onToggle}>
            Close
          </button>
        )}
      </div>

      <nav className="portal-sidebar-nav mt-1 space-y-0.5 px-2 pb-3">
        {items.map((item) => {
          const isActive = active === item;
          const isDanger = item === "Delete Account" || item === "Logout";
          const Icon = getIcon(item);

          return (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-[color:var(--sidebar-active)] text-[color:var(--primary-deep)]"
                  : isDanger
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-[color:var(--sidebar-text)] hover:bg-[color:var(--sidebar-hover)]"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[color:var(--primary-soft)]" />
              )}
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-[color:var(--primary-soft)]" : "text-[color:var(--sidebar-text-muted)] group-hover:text-[color:var(--primary)]"
                }`}
                strokeWidth={2}
              />
              <span className="truncate">{item}</span>
            </button>
          );
        })}
      </nav>

      <div className="mx-2 mb-3 shrink-0 rounded-lg border border-[color:var(--sidebar-border)] bg-[color:var(--paper-strong)] p-3">
        <div className="text-xs font-semibold text-[color:var(--ink)]">Need assistance?</div>
        <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--sidebar-text-muted)]">
          Contact the NPTEL incentives office for approval queries.
        </p>
        <a
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--primary-soft)] hover:underline"
          href="mailto:npteladmin@sbjit.edu.in"
        >
          npteladmin@sbjit.edu.in
        </a>
      </div>
    </aside>
  );
}
