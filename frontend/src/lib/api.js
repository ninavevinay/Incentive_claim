const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "token";

function getStorage() {
  return window.sessionStorage;
}

export function getToken() {
  const storage = getStorage();
  return storage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  const storage = getStorage();
  storage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  const storage = getStorage();
  storage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    let message = data.detail || "Request failed";
    if (Array.isArray(data.detail)) {
      message = data.detail.map((item) => item.msg || "Invalid input").join(", ");
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  registerAuthority: (payload) => request("/auth/register-authority", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/profile/me"),
  updateProfile: (payload) => request("/profile/me", { method: "PUT", body: JSON.stringify(payload) }),
  submitStudent: (payload) => request("/applications/student", { method: "POST", body: payload }),
  submitFaculty: (payload) => request("/applications/faculty", { method: "POST", body: payload }),
  myApplications: () => request("/applications/mine"),
  pendingApplications: (department) => request(`/applications/pending?department=${encodeURIComponent(department)}`),
  allApplications: (department) => request(`/applications/all?department=${encodeURIComponent(department)}`),
  myReviewedApplications: (action) =>
    request(`/applications/my-reviewed${action ? `?action=${encodeURIComponent(action)}` : ""}`),
  roleReviewedApplications: (action) =>
    request(`/applications/role-reviewed${action ? `?action=${encodeURIComponent(action)}` : ""}`),
  reviewApplication: (id, action, remark, approved_amount) =>
    request(`/applications/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, remark, approved_amount })
    }),
  track: (id) => request(`/applications/track/${id}`),
  notifications: () => request("/notifications/"),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
  adminUsers: () => request("/admin/users"),
  adminApplications: () => request("/admin/applications"),
  adminLoginEvents: () => request("/admin/login-events"),
  adminPasswordResets: () => request("/admin/password-resets"),
  adminSetUserPassword: (payload) =>
    request("/admin/users/password", { method: "POST", body: JSON.stringify(payload) }),
  adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" })
};
