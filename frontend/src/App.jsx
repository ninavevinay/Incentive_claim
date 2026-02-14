import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Register from "./pages/Register.jsx";
import AuthorityRegister from "./pages/AuthorityRegister.jsx";
import AdminRegister from "./pages/AdminRegister.jsx";
import Login from "./pages/Login.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import FacultyDashboard from "./pages/FacultyDashboard.jsx";
import AuthorityDashboard from "./pages/AuthorityDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { getDashboardPathForUser, slugifyDepartment } from "./lib/routeMap.js";

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) return <Navigate to={getDashboardPathForUser(user)} replace />;
  }
  return children;
}

function AuthorityProtected({ children, role, departmentScoped = false }) {
  const { user, loading } = useAuth();
  const { departmentSlug } = useParams();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={getDashboardPathForUser(user)} replace />;

  if (departmentScoped) {
    const expectedDepartmentSlug = slugifyDepartment(user.department);
    if (!expectedDepartmentSlug || departmentSlug !== expectedDepartmentSlug) {
      return <Navigate to={getDashboardPathForUser(user)} replace />;
    }
  }

  return children;
}

function AuthorityEntryRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getDashboardPathForUser(user)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 px-3 py-4 sm:px-4 md:px-8 lg:px-10">
          <div className="panel px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.jpg"
                  alt="SB Jain"
                  className="h-12 w-12 rounded-full border border-black/10 bg-white object-contain"
                />
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-black/40">Institution</div>
                  <div className="mt-1 text-lg font-semibold font-display sm:text-xl">
                    S.B. Jain Institute of Technology Management and Research
                  </div>
                </div>
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Incentive Portal</div>
            </div>
          </div>
        </header>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register-authority" element={<AuthorityRegister />} />
        <Route path="/register-admin" element={<AdminRegister />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <Protected role="admin">
              <AdminDashboard />
            </Protected>
          }
        />
        <Route
          path="/student"
          element={
            <Protected role="student">
                  <StudentDashboard />
                </Protected>
              }
            />
            <Route
              path="/faculty"
              element={
                <Protected role="faculty">
                  <FacultyDashboard />
                </Protected>
              }
            />
            <Route path="/authority" element={<AuthorityEntryRedirect />} />
            <Route
              path="/authority/department-coordinator"
              element={
                <AuthorityProtected role="department_coordinator">
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route
              path="/authority/department-coordinator/:departmentSlug"
              element={
                <AuthorityProtected role="department_coordinator" departmentScoped>
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route
              path="/authority/department-hod"
              element={
                <AuthorityProtected role="department_hod">
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route
              path="/authority/department-hod/:departmentSlug"
              element={
                <AuthorityProtected role="department_hod" departmentScoped>
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route
              path="/authority/institution-coordinator"
              element={
                <AuthorityProtected role="institution_coordinator">
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
          </Routes>
        </main>
        <footer className="px-3 py-4 sm:px-4 md:px-8 lg:px-10">
          <div className="panel px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-[0.2em] text-black/40">Developed by Vinay</div>
              <div className="text-xs text-black/60">All rights reserved.</div>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
