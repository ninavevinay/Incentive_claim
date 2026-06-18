import Sidebar from "./Sidebar.jsx";

export default function DashboardMobileSidebar({ open, onClose, items, active, onSelect, user }) {
  if (!open) return null;

  return (
    <div className="dashboard-mobile-overlay lg:hidden">
      <div className="dashboard-mobile-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="dashboard-mobile-drawer">
        <Sidebar
          items={items}
          active={active}
          user={user}
          showToggle
          onToggle={onClose}
          onSelect={(item) => {
            onSelect(item);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
