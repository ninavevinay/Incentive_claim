import { useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { api } from "../lib/api.js";
import { useAuth, logout } from "../lib/auth.jsx";

const AUTHORITY_ROLES = [
  { value: "department_coordinator", label: "Department Coordinator" },
  { value: "department_hod", label: "Department HOD" },
  { value: "institution_coordinator", label: "Institution Coordinator" }
];

const DEPARTMENTS = [
  "First Year",
  "CSE",
  "AIML",
  "AIDS",
  "ETC",
  "IT",
  "EE",
  "ME",
  "CA (Computer Applications)",
  "BA (Business Administration)"
];
const ADMIN_SECTIONS = [
  "Register Authority",
  "Registered Users",
  "Login Events",
  "User Feedback",
  "All Applications",
  "Form Filling Window"
];

export default function AdminDashboard() {
  const { user, setUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loginEvents, setLoginEvents] = useState([]);
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [error, setError] = useState("");
  const [passwordForm, setPasswordForm] = useState({ new_password: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFilter, setUserFilter] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [feedbackFilter, setFeedbackFilter] = useState("");
  const [expandedAppId, setExpandedAppId] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [activeSection, setActiveSection] = useState("Register Authority");
  const [formWindowForm, setFormWindowForm] = useState({ start_date: "", end_date: "" });
  const [formWindowMessage, setFormWindowMessage] = useState("");
  const [applicationsMessage, setApplicationsMessage] = useState({ type: "", text: "" });
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [feedbackExporting, setFeedbackExporting] = useState(false);
  const [feedbackExportMessage, setFeedbackExportMessage] = useState("");
  const [authorityForm, setAuthorityForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "department_coordinator",
    department: ""
  });
  const [authorityMessage, setAuthorityMessage] = useState("");

  useEffect(() => {
    Promise.all([
      api.adminUsers(),
      api.adminApplications(),
      api.adminLoginEvents(),
      api.adminFeedback(),
      api.adminFormWindow()
    ])
      .then(([usersData, appsData, loginData, feedbackData, formWindowData]) => {
        setUsers(usersData);
        setApplications(appsData);
        setLoginEvents(loginData);
        setFeedbackEntries(feedbackData);
        setFormWindowForm({
          start_date: formWindowData?.start_date || "",
          end_date: formWindowData?.end_date || ""
        });
      })
      .catch((err) => setError(err.message || "Failed to load admin data"));
  }, []);

  useEffect(() => {
    const handleToggle = () => setSidebarOpen((prev) => !prev);
    window.addEventListener("portal:toggle-dashboard-menu", handleToggle);
    return () => window.removeEventListener("portal:toggle-dashboard-menu", handleToggle);
  }, []);

  const filteredUsers = users.filter((u) => {
    const value = `${u.name} ${u.email} ${u.role} ${u.department}`.toLowerCase();
    return value.includes(userFilter.trim().toLowerCase());
  });

  const filteredApplications = applications.filter((app) => {
    const value = [
      app.id,
      app.application_type,
      app.status,
      app.data?.applicant_name,
      app.data?.application_name,
      app.data?.department
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return value.includes(applicationFilter.trim().toLowerCase());
  });

  const filteredFeedback = feedbackEntries.filter((entry) => {
    const value = `${entry.name} ${entry.email} ${entry.role} ${entry.department} ${entry.benefit_status ?? ""} ${entry.message} ${entry.rating ?? ""}`.toLowerCase();
    return value.includes(feedbackFilter.trim().toLowerCase());
  });

  const sortedApplications = [...filteredApplications].sort((a, b) => a.id - b.id);
  const selectedApplication = sortedApplications.find((app) => app.id === expandedAppId) || null;

  const matchingUsers = users.filter((u) => {
    const value = `${u.name} ${u.email}`.toLowerCase();
    return userQuery.trim() && value.includes(userQuery.trim().toLowerCase());
  });

  const submitPassword = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    try {
      if (!selectedUser) {
        setPasswordMessage("Select a user to update.");
        return;
      }
      await api.adminSetUserPassword({
        user_id: selectedUser.id,
        new_password: passwordForm.new_password
      });
      setPasswordMessage("Password updated.");
      setPasswordForm({ new_password: "" });
      setUserQuery("");
      setSelectedUser(null);
    } catch (err) {
      setPasswordMessage(err.message || "Failed to update password");
    }
  };

  const submitAuthorityUser = async (e) => {
    e.preventDefault();
    setAuthorityMessage("");
    try {
      const createdUser = await api.adminCreateAuthorityUser(authorityForm);
      setUsers((prev) => [createdUser, ...prev]);
      setAuthorityForm({
        name: "",
        email: "",
        password: "",
        role: "department_coordinator",
        department: ""
      });
      setAuthorityMessage("Authority user created.");
    } catch (err) {
      setAuthorityMessage(err.message || "Failed to create authority user");
    }
  };

  const deleteUser = async (userId) => {
    setPasswordMessage("");
    try {
      if (!window.confirm("Delete this user and all related data?")) return;
      await api.adminDeleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
        setUserQuery("");
      }
    } catch (err) {
      setPasswordMessage(err.message || "Failed to delete user");
    }
  };

  const submitFormWindow = async (e) => {
    e.preventDefault();
    setFormWindowMessage("");
    try {
      if (!formWindowForm.start_date || !formWindowForm.end_date) {
        setFormWindowMessage("Select both start date and end date.");
        return;
      }
      const updated = await api.adminSetFormWindow(formWindowForm);
      setFormWindowForm({
        start_date: updated?.start_date || "",
        end_date: updated?.end_date || ""
      });
      setFormWindowMessage("Form filling window updated.");
    } catch (err) {
      setFormWindowMessage(err.message || "Failed to update form window");
    }
  };

  const deleteApplication = async (appId) => {
    setApplicationsMessage({ type: "", text: "" });
    try {
      if (!window.confirm("Delete this application permanently?")) return;
      await api.adminDeleteApplication(appId);
      setApplications((prev) => prev.filter((app) => app.id !== appId));
      if (expandedAppId === appId) {
        setExpandedAppId(null);
        setViewMode("list");
      }
      setApplicationsMessage({ type: "success", text: `Application ${appId} deleted.` });
    } catch (err) {
      setApplicationsMessage({ type: "error", text: err.message || "Failed to delete application" });
    }
  };

  const deleteAllApplications = async () => {
    setApplicationsMessage({ type: "", text: "" });
    if (applications.length === 0) {
      setApplicationsMessage({ type: "error", text: "No applications to delete." });
      return;
    }
    const confirmation = window.prompt('Type "DELETE" to remove all applications.');
    if (confirmation !== "DELETE") return;
    setBulkDeleting(true);
    try {
      await api.adminDeleteAllApplications();
      setApplications([]);
      setExpandedAppId(null);
      setViewMode("list");
      setApplicationsMessage({ type: "success", text: "All applications deleted." });
    } catch (err) {
      setApplicationsMessage({ type: "error", text: err.message || "Failed to delete applications" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const exportFeedbackPdf = async () => {
    setFeedbackExportMessage("");
    if (feedbackEntries.length === 0) {
      setFeedbackExportMessage("No feedback available to export.");
      return;
    }

    setFeedbackExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default || autoTableModule.autoTable;
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const margin = 36;
      const generatedAt = new Date();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("User Feedback Report", margin, 42);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generated: ${generatedAt.toLocaleString()}`, margin, 58);
      doc.text(`Total feedback entries: ${feedbackEntries.length}`, margin, 72);

      const tableHead = [[
        "Sr No",
        "Name",
        "Email",
        "Role",
        "Department",
        "Benefit",
        "Rating",
        "Message",
        "Time"
      ]];

      const tableBody = feedbackEntries.map((entry, index) => [
        String(index + 1),
        entry.name || "-",
        entry.email || "-",
        entry.role || "-",
        entry.department || "-",
        String(entry.benefit_status || "beneficial").replace(/_/g, " "),
        entry.rating != null ? `${entry.rating}/5` : "-",
        entry.message || "-",
        entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"
      ]);

      autoTable(doc, {
        startY: 82,
        margin: { left: margin, right: margin },
        head: tableHead,
        body: tableBody,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 3,
          valign: "top",
          textColor: 30
        },
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: 255,
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 34, halign: "center" },
          1: { cellWidth: 68 },
          2: { cellWidth: 108 },
          3: { cellWidth: 56 },
          4: { cellWidth: 66 },
          5: { cellWidth: 58 },
          6: { cellWidth: 46, halign: "center" },
          7: { cellWidth: 120 },
          8: { cellWidth: 72 }
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(9);
          doc.setTextColor(80);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            doc.internal.pageSize.getWidth() - margin,
            doc.internal.pageSize.getHeight() - 12,
            { align: "right" }
          );
        }
      });

      const fileDate = new Date().toISOString().slice(0, 10);
      doc.save(`user-feedback-${fileDate}.pdf`);
      setFeedbackExportMessage("Feedback exported as PDF.");
    } catch (err) {
      setFeedbackExportMessage(err?.message || "Failed to export feedback PDF.");
    } finally {
      setFeedbackExporting(false);
    }
  };

  const selectSection = (section) => {
    setActiveSection(section);
    setViewMode("list");
    setSidebarOpen(false);
    setApplicationsMessage({ type: "", text: "" });
  };

  return (
    <div className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8 lg:min-h-screen lg:px-10">
      <div className="mx-auto w-full max-w-7xl lg:max-w-none">
        <div className="mb-4 lg:hidden">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Admin</div>
            <div className="text-lg font-semibold font-display">System Control</div>
          </div>
        </div>
        <div className="dashboard-shell" style={{ "--sidebar-width": "220px" }}>
          <div className="dashboard-sidebar">
            <Sidebar items={ADMIN_SECTIONS} active={activeSection} onSelect={selectSection} user={user} />
          </div>
        <div className="card dashboard-content">
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-black/40">Admin Console</div>
            <div className="text-lg font-semibold font-display">System Control</div>
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => logout(setUser)}>
            Logout
          </button>
        </div>
        <Topbar title="Administrative Panel" subtitle="System-wide visibility for users and applications" />
        {error && <div className="mt-4 text-sm text-rose-600">{error}</div>}

        <section className="mt-8">
          {activeSection === "Register Authority" && (
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Create Authority User</div>
              <form onSubmit={submitAuthorityUser} className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  className="input"
                  placeholder="Full name"
                  value={authorityForm.name}
                  onChange={(e) => setAuthorityForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <input
                  className="input"
                  type="email"
                  placeholder="Email"
                  value={authorityForm.email}
                  onChange={(e) => setAuthorityForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
                <input
                  className="input"
                  type="password"
                  placeholder="Password"
                  value={authorityForm.password}
                  onChange={(e) => setAuthorityForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
                <select
                  className="input"
                  value={authorityForm.role}
                  onChange={(e) => setAuthorityForm((prev) => ({ ...prev, role: e.target.value }))}
                  required
                >
                  {AUTHORITY_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                <select
                  className="input"
                  value={authorityForm.department}
                  onChange={(e) => setAuthorityForm((prev) => ({ ...prev, department: e.target.value }))}
                  required
                >
                  <option value="" disabled>Select department</option>
                  {DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
                <button className="btn btn-primary" type="submit">Create Authority User</button>
              </form>
              {authorityMessage && <div className="mt-2 text-sm text-black/70">{authorityMessage}</div>}
            </div>
          )}

          <div className="panel p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/40">Change User Password</div>
            <form onSubmit={submitPassword} className="mt-4 grid gap-3 md:grid-cols-[2fr_2fr_1fr]">
              <input
                className="input"
                placeholder="Search user by name or email"
                value={userQuery}
                onChange={(e) => {
                  setUserQuery(e.target.value);
                  setSelectedUser(null);
                }}
                required
              />
              <input
                className="input"
                type="password"
                placeholder="New password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
                required
              />
              <button className="btn btn-primary" type="submit">Update</button>
            </form>
            {userQuery && matchingUsers.length > 0 && !selectedUser && (
              <div className="mt-3 grid gap-2">
                {matchingUsers.slice(0, 6).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="panel px-3 py-2 text-left text-sm hover:bg-black/5"
                    onClick={() => {
                      setSelectedUser(u);
                      setUserQuery(`${u.name} (${u.email})`);
                    }}
                  >
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-black/60">{u.email} - {u.role} - {u.department}</div>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-3 text-sm">
                <div className="text-xs uppercase tracking-[0.2em] text-black/40">Selected User</div>
                <div className="mt-2 font-semibold">{selectedUser.name}</div>
                <div className="text-black/70">{selectedUser.email}</div>
                <div className="text-black/60">{selectedUser.role} - {selectedUser.department}</div>
              </div>
            )}
            {passwordMessage && <div className="mt-2 text-sm text-black/70">{passwordMessage}</div>}
          </div>

          {activeSection === "Registered Users" && (
          <div className="mt-6 panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold font-display">Registered Users</h2>
              <div className="muted text-sm">{users.length} total</div>
            </div>
            <div className="mt-3">
              <input
                className="input"
                placeholder="Search users by name, email, role, department"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              />
            </div>
            <div className="mt-4">
              <div className="grid gap-3 sm:hidden">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="panel p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{u.name}</div>
                      <button
                        className="btn btn-ghost text-rose-600"
                        type="button"
                        onClick={() => deleteUser(u.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-black/60">{u.email}</div>
                    <div className="mt-2 text-sm text-black/70">Role: {u.role}</div>
                    <div className="text-sm text-black/70">Department: {u.department}</div>
                  </div>
                ))}
              </div>
              <table className="hidden w-full text-left text-sm sm:table">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-black/40">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 pr-4 font-medium">{u.name}</td>
                      <td className="py-3 pr-4">{u.email}</td>
                      <td className="py-3 pr-4">{u.role}</td>
                      <td className="py-3 pr-4">{u.department}</td>
                      <td className="py-3 pr-4">
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => deleteUser(u.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <div className="muted mt-3 text-sm">No users found.</div>}
            </div>
          </div>
          )}
        </section>

        {activeSection === "Login Events" && (
        <section className="mt-10 panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold font-display">Login Events</h2>
            <div className="muted text-sm">{loginEvents.length} recent</div>
          </div>
          <div className="mt-4">
            <div className="grid gap-3 sm:hidden">
              {loginEvents.map((e) => (
                <div key={e.id} className="panel p-3">
                  <div className="font-semibold">{e.email}</div>
                  <div className="mt-1 text-xs text-black/60">{e.ip_address}</div>
                  <div className="mt-2 text-sm text-black/70">{e.user_agent}</div>
                  <div className="mt-2 text-xs text-black/50">{new Date(e.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <table className="hidden w-full text-left text-sm sm:table">
              <thead>
                <tr className="text-xs uppercase tracking-[0.2em] text-black/40">
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">IP Address</th>
                  <th className="py-2 pr-4">User Agent</th>
                  <th className="py-2 pr-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {loginEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="py-3 pr-4 font-medium">{e.email}</td>
                    <td className="py-3 pr-4">{e.ip_address}</td>
                    <td className="py-3 pr-4 max-w-[280px] truncate" title={e.user_agent}>{e.user_agent}</td>
                    <td className="py-3 pr-4">{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loginEvents.length === 0 && <div className="muted mt-3 text-sm">No login events.</div>}
          </div>
        </section>
        )}

        {activeSection === "User Feedback" && (
        <section className="mt-10 panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold font-display">User Feedback</h2>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={exportFeedbackPdf}
                disabled={feedbackExporting}
              >
                {feedbackExporting ? "Exporting..." : "Export PDF"}
              </button>
              <div className="muted text-sm">{feedbackEntries.length} total</div>
            </div>
          </div>
          <div className="mt-3">
            <input
              className="input"
              placeholder="Search by user, role, benefit status, department, or feedback text"
              value={feedbackFilter}
              onChange={(e) => setFeedbackFilter(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <div className="grid gap-3 sm:hidden">
              {filteredFeedback.map((entry) => (
                <div key={entry.id} className="panel p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{entry.name}</div>
                    <div className="text-xs font-semibold text-black/70">Rating: {entry.rating ?? "-"}/5</div>
                  </div>
                  <div className="mt-1 text-xs text-black/60">{entry.email}</div>
                  <div className="mt-1 text-xs text-black/60">{entry.role} - {entry.department}</div>
                  <div className="mt-1 text-xs text-black/60">
                    Benefit: {String(entry.benefit_status || "beneficial").replace(/_/g, " ")}
                  </div>
                  <div className="mt-2 text-sm text-black/80">{entry.message}</div>
                  <div className="mt-2 text-xs text-black/50">{new Date(entry.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <table className="hidden w-full text-left text-sm sm:table">
              <thead>
                <tr className="text-xs uppercase tracking-[0.2em] text-black/40">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Benefit</th>
                  <th className="py-2 pr-4">Rating</th>
                  <th className="py-2 pr-4">Message</th>
                  <th className="py-2 pr-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {filteredFeedback.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{entry.name}</div>
                      <div className="text-xs text-black/60">{entry.email}</div>
                      <div className="text-xs text-black/60">{entry.department}</div>
                    </td>
                    <td className="py-3 pr-4">{entry.role}</td>
                    <td className="py-3 pr-4">{String(entry.benefit_status || "beneficial").replace(/_/g, " ")}</td>
                    <td className="py-3 pr-4">{entry.rating ?? "-"}/5</td>
                    <td className="py-3 pr-4 max-w-[360px]">{entry.message}</td>
                    <td className="py-3 pr-4">{new Date(entry.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredFeedback.length === 0 && <div className="muted mt-3 text-sm">No feedback found.</div>}
            {feedbackExportMessage && <div className="mt-3 text-sm text-black/70">{feedbackExportMessage}</div>}
          </div>
        </section>
        )}

        {activeSection === "Form Filling Window" && (
        <section className="mt-10 panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold font-display">Form Filling Window</h2>
            <div className="muted text-sm">Admin control</div>
          </div>
          <form onSubmit={submitFormWindow} className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              className="input"
              type="date"
              value={formWindowForm.start_date}
              onChange={(e) => setFormWindowForm((prev) => ({ ...prev, start_date: e.target.value }))}
              required
            />
            <input
              className="input"
              type="date"
              value={formWindowForm.end_date}
              onChange={(e) => setFormWindowForm((prev) => ({ ...prev, end_date: e.target.value }))}
              required
            />
            <div className="md:col-span-3 flex justify-end">
              <button className="btn btn-primary w-full md:w-auto" type="submit">Save Window</button>
            </div>
          </form>
          <div className="muted mt-3 text-sm">
            Applications can be submitted only between selected start and end dates.
          </div>
          {formWindowMessage && <div className="mt-2 text-sm text-black/70">{formWindowMessage}</div>}
        </section>
        )}

        {activeSection === "All Applications" && (
        <section className="mt-10 panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold font-display">All Applications</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setViewMode("all-details")}
              >
                All Details
              </button>
              <button
                className="btn btn-ghost text-rose-600"
                type="button"
                onClick={deleteAllApplications}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Deleting..." : "Delete All"}
              </button>
              <div className="muted text-sm">{applications.length} recent</div>
            </div>
          </div>
          <div className="mt-3">
            <input
              className="input"
              placeholder="Search applications by applicant, status, department, type"
              value={applicationFilter}
              onChange={(e) => setApplicationFilter(e.target.value)}
            />
          </div>
          <div className="mt-4">
            {viewMode === "details" && selectedApplication ? (
              <div className="panel p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Application Details</div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-ghost" type="button" onClick={() => setViewMode("list")}>Back</button>
                    <button
                      className="btn btn-ghost text-rose-600"
                      type="button"
                      onClick={() => deleteApplication(selectedApplication.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {Object.entries(selectedApplication.data || {}).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-black/10 bg-white/70 p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-black/40">{key.replace(/_/g, " ")}</div>
                      <div className="mt-1 text-sm text-black/80">{String(value ?? "-")}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : viewMode === "all-details" ? (
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">All Application Details</div>
                  <button className="btn btn-ghost" type="button" onClick={() => setViewMode("list")}>Back</button>
                </div>
                {sortedApplications.map((app) => (
                  <div key={app.id} className="panel p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Application #{app.id} - {app.data?.applicant_name || "-"}</div>
                      <button
                        className="btn btn-ghost text-rose-600"
                        type="button"
                        onClick={() => deleteApplication(app.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="muted mt-1">{app.application_type} | {app.status} | {app.data?.department || "-"}</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {Object.entries(app.data || {}).map(([key, value]) => (
                        <div key={`${app.id}-${key}`} className="rounded-xl border border-black/10 bg-white/70 p-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-black/40">{key.replace(/_/g, " ")}</div>
                          <div className="mt-1 text-sm text-black/80">{String(value ?? "-")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {sortedApplications.length === 0 && (
                  <div className="muted mt-3 text-sm">No applications.</div>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:hidden">
                  {sortedApplications.map((app) => (
                    <div key={app.id} className="panel p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">
                          {app.data?.applicant_name || app.data?.application_name || "-"}
                        </div>
                        <span className="badge">{app.status}</span>
                      </div>
                      <div className="muted mt-1 text-xs">ID: {app.id}</div>
                      <div className="mt-2 text-sm text-black/70">
                        <span className="text-black/50">Type:</span> {app.application_type}
                      </div>
                      <div className="text-sm text-black/70">
                        <span className="text-black/50">Department:</span> {app.data?.department || "-"}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => {
                            setExpandedAppId(app.id);
                            setViewMode("details");
                          }}
                        >
                          Details
                        </button>
                        <button
                          className="btn btn-ghost text-rose-600"
                          type="button"
                          onClick={() => deleteApplication(app.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <table className="hidden w-full text-left text-sm sm:table">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.2em] text-black/40">
                      <th className="py-2 pr-4">ID</th>
                      <th className="py-2 pr-4">Applicant</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Department</th>
                      <th className="py-2 pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {sortedApplications.map((app) => (
                      <tr key={app.id}>
                        <td className="py-3 pr-4">{app.id}</td>
                        <td className="py-3 pr-4 font-medium">{app.data?.applicant_name || app.data?.application_name || "-"}</td>
                        <td className="py-3 pr-4">{app.application_type}</td>
                        <td className="py-3 pr-4">{app.status}</td>
                        <td className="py-3 pr-4">{app.data?.department || "-"}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() => {
                                setExpandedAppId(app.id);
                                setViewMode("details");
                              }}
                            >
                              Details
                            </button>
                            <button
                              className="btn btn-ghost text-rose-600"
                              type="button"
                              onClick={() => deleteApplication(app.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {applicationsMessage.text && (
              <div className={`mt-3 text-sm ${applicationsMessage.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
                {applicationsMessage.text}
              </div>
            )}
            {viewMode === "list" && sortedApplications.length === 0 && (
              <div className="muted mt-3 text-sm">No applications.</div>
            )}
          </div>
        </section>
        )}
        </div>
      </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-4 right-4 top-6">
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold font-display">Menu</div>
                <button className="btn btn-ghost" onClick={() => setSidebarOpen(false)} aria-label="Close menu" type="button">
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <Sidebar
                  items={ADMIN_SECTIONS}
                  active={activeSection}
                  user={user}
                  onSelect={(section) => {
                    selectSection(section);
                    setSidebarOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
