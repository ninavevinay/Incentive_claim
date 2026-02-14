import { useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { api } from "../lib/api.js";
import { useAuth, logout } from "../lib/auth.jsx";

export default function AdminDashboard() {
  const { setUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loginEvents, setLoginEvents] = useState([]);
  const [error, setError] = useState("");
  const [passwordForm, setPasswordForm] = useState({ new_password: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFilter, setUserFilter] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [expandedAppId, setExpandedAppId] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [activeSection, setActiveSection] = useState("Registered Users");

  useEffect(() => {
    Promise.all([
      api.adminUsers(),
      api.adminApplications(),
      api.adminLoginEvents()
    ])
      .then(([usersData, appsData, loginData]) => {
        setUsers(usersData);
        setApplications(appsData);
        setLoginEvents(loginData);
      })
      .catch((err) => setError(err.message || "Failed to load admin data"));
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

  return (
    <div className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8 lg:h-screen lg:overflow-hidden lg:px-10">
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="panel hidden h-full flex-col p-4 lg:flex">
          <div className="text-xs uppercase tracking-[0.2em] text-black/40">Navigation</div>
          <div className="mt-4 space-y-2">
            <button
              className={`w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold ${
                activeSection === "Registered Users" ? "bg-black text-white" : "hover:bg-black/5"
              }`}
              onClick={() => {
                setActiveSection("Registered Users");
                setViewMode("list");
              }}
              type="button"
            >
              Registered Users
            </button>
            <button
              className={`w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold ${
                activeSection === "Login Events" ? "bg-black text-white" : "hover:bg-black/5"
              }`}
              onClick={() => {
                setActiveSection("Login Events");
                setViewMode("list");
              }}
              type="button"
            >
              Login Events
            </button>
            <button
              className={`w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold ${
                activeSection === "All Applications" ? "bg-black text-white" : "hover:bg-black/5"
              }`}
              onClick={() => {
                setActiveSection("All Applications");
                setViewMode("list");
              }}
              type="button"
            >
              All Applications
            </button>
          </div>
        </aside>
        <div className="card h-full min-h-0 overflow-y-auto p-6 md:p-8">
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
          <div className="mt-6 panel flex h-[60vh] min-h-[320px] flex-col p-4">
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
            <div className="mt-4 flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
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
        <section className="mt-10 panel flex h-[60vh] min-h-[320px] flex-col p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold font-display">Login Events</h2>
            <div className="muted text-sm">{loginEvents.length} recent</div>
          </div>
          <div className="mt-4 flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
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

        {activeSection === "All Applications" && (
        <section className="mt-10 panel flex h-[60vh] min-h-[320px] flex-col p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold font-display">All Applications</h2>
            <div className="muted text-sm">{applications.length} recent</div>
          </div>
          <div className="mt-3">
            <input
              className="input"
              placeholder="Search applications by applicant, status, department, type"
              value={applicationFilter}
              onChange={(e) => setApplicationFilter(e.target.value)}
            />
          </div>
          <div className="mt-4 flex-1 overflow-auto">
            {viewMode === "details" && selectedApplication ? (
              <div className="panel p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-black/40">Application Details</div>
                  <button className="btn btn-ghost" type="button" onClick={() => setViewMode("list")}>Back</button>
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
            ) : (
              <table className="w-full text-left text-sm">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
  );
}
