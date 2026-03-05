const API_URL = import.meta.env.VITE_API_URL || "/api";
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
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/profile/me"),
  updateProfile: (payload) => request("/profile/me", { method: "PUT", body: JSON.stringify(payload) }),
  deleteMe: () => request("/profile/me", { method: "DELETE" }),
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
  submitFeedback: (payload) => request("/feedback/", { method: "POST", body: JSON.stringify(payload) }),
  myFeedback: () => request("/feedback/mine"),
  publicNotices: () => request("/notices/public"),
  createNotice: (payload) => request("/notices/", { method: "POST", body: payload }),
  adminUsers: () => request("/admin/users"),
  adminApplications: () => request("/admin/applications"),
  adminDeleteApplication: (id) => request(`/admin/applications/${id}`, { method: "DELETE" }),
  adminDeleteAllApplications: () => request("/admin/applications", { method: "DELETE" }),
  adminLoginEvents: () => request("/admin/login-events"),
  adminFeedback: () => request("/admin/feedback"),
  adminPasswordResets: () => request("/admin/password-resets"),
  adminFormWindow: () => request("/admin/form-window"),
  adminSetFormWindow: (payload) =>
    request("/admin/form-window", { method: "PUT", body: JSON.stringify(payload) }),
  adminCreateAuthorityUser: (payload) =>
    request("/admin/users/authority", { method: "POST", body: JSON.stringify(payload) }),
  adminSetUserPassword: (payload) =>
    request("/admin/users/password", { method: "POST", body: JSON.stringify(payload) }),
  adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" })
};
