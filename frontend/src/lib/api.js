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

function toQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    query.set(key, normalized);
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function normalizeDepartmentArgs(args) {
  if (typeof args === "string") {
    return { department: args };
  }
  return args || {};
}

export const api = {
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  requestOtp: (payload) => request("/auth/request-otp", { method: "POST", body: JSON.stringify(payload) }),
  verifyOtp: (payload) => request("/auth/verify-otp", { method: "POST", body: JSON.stringify(payload) }),
  forgotPassword: (payload) => request("/auth/forgot-password", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/profile/me"),
  updateProfile: (payload) => request("/profile/me", { method: "PUT", body: JSON.stringify(payload) }),
  deleteMe: () => request("/profile/me", { method: "DELETE" }),
  submitStudent: (payload) => request("/applications/student", { method: "POST", body: payload }),
  submitFaculty: (payload) => request("/applications/faculty", { method: "POST", body: payload }),
  myApplications: (params = {}) => request(`/applications/mine${toQueryString(params)}`),
  pendingApplications: (args = {}) => {
    const params = normalizeDepartmentArgs(args);
    return request(`/applications/pending${toQueryString(params)}`);
  },
  allApplications: (args = {}) => {
    const params = normalizeDepartmentArgs(args);
    return request(`/applications/all${toQueryString(params)}`);
  },
  myReviewedApplications: (action, params = {}) =>
    request(`/applications/my-reviewed${toQueryString({ action, ...(params || {}) })}`),
  roleReviewedApplications: (action, params = {}) =>
    request(`/applications/role-reviewed${toQueryString({ action, ...(params || {}) })}`),
  reviewApplication: (id, action, remark, approved_amount) =>
    request(`/applications/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, remark, approved_amount })
    }),
  track: (id) => request(`/applications/track/${id}`),
  notifications: () => request("/notifications/"),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
  submitFeedback: (payload) => request("/feedback/", { method: "POST", body: JSON.stringify(payload) }),
  myFeedback: (params = {}) => request(`/feedback/mine${toQueryString(params)}`),
  feedbackReport: (params = {}) => request(`/feedback/report${toQueryString(params)}`),
  publicNotices: () => request("/notices/public"),
  publicApprovedHighlights: (params = {}) =>
    request(`/applications/public-approved-highlights${toQueryString(params)}`),
  createNotice: (payload) => request("/notices/", { method: "POST", body: payload }),
  adminUsers: (params = {}) => request(`/admin/users${toQueryString(params)}`),
  adminApplications: (params = {}) => request(`/admin/applications${toQueryString(params)}`),
  adminDeleteApplication: (id) => request(`/admin/applications/${id}`, { method: "DELETE" }),
  adminDeleteAllApplications: () => request("/admin/applications", { method: "DELETE" }),
  adminLoginEvents: (params = {}) => request(`/admin/login-events${toQueryString(params)}`),
  adminFeedback: (params = {}) => request(`/admin/feedback${toQueryString(params)}`),
  adminPasswordResets: (params = {}) => request(`/admin/password-resets${toQueryString(params)}`),
  adminFormWindow: () => request("/admin/form-window"),
  adminSetFormWindow: (payload) =>
    request("/admin/form-window", { method: "PUT", body: JSON.stringify(payload) }),
  adminCreateAuthorityUser: (payload) =>
    request("/admin/users/authority", { method: "POST", body: JSON.stringify(payload) }),
  coordinatorAuthorityUsers: (params = {}) =>
    request(`/admin/coordinator/authority-users${toQueryString(params)}`),
  coordinatorSetAuthorityUserStatus: (id, is_active) =>
    request(`/admin/coordinator/authority-users/${id}/status${toQueryString({ is_active })}`, { method: "PUT" }),
  coordinatorDeleteAuthorityUser: (id) =>
    request(`/admin/coordinator/authority-users/${id}`, { method: "DELETE" }),
  adminDeleteAllNonAdminUsers: () => request("/admin/users/non-admin", { method: "DELETE" }),
  adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" })
};
