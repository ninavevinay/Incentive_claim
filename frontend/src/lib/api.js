import {
  buildPortalError,
  dispatchPortalError,
  getErrorMessage,
  PortalError,
  readResponsePayload,
  shouldNotifyGlobalError
} from "./errors.js";

const DEFAULT_API_BASE = "/api";
const RAW_API_URL = String(import.meta.env.VITE_API_URL || "").trim();

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const stripTrailingSlashes = (value) => String(value || "").trim().replace(/\/+$/, "");

const normalizeApiBase = (value) => {
  const raw = stripTrailingSlashes(value);
  if (!raw) return DEFAULT_API_BASE;
  if (raw.endsWith("/api")) return raw;
  return `${raw}/api`;
};

const API_URL = normalizeApiBase(RAW_API_URL || DEFAULT_API_BASE);

const API_ORIGIN = (() => {
  if (isAbsoluteUrl(API_URL)) {
    try {
      return new URL(API_URL).origin;
    } catch {
      return typeof window !== "undefined" ? window.location.origin : "";
    }
  }
  return typeof window !== "undefined" ? window.location.origin : "";
})();
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

export function resolveMediaUrl(path) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (isAbsoluteUrl(value)) return value;
  if (!API_ORIGIN) return value;
  return value.startsWith("/") ? `${API_ORIGIN}${value}` : `${API_ORIGIN}/${value}`;
}

async function request(path, options = {}) {
  const { skipAuth = false, notifyOnError, ...requestOptions } = options;
  const token = getToken();
  const method = String(requestOptions.method || "GET").toUpperCase();
  const isFormData = requestOptions.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(requestOptions.headers || {})
  };
  if (!skipAuth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers
    });
  } catch (error) {
    const networkError = new PortalError(
      getErrorMessage(error, "Unable to reach the server. Please check your connection and try again."),
      { status: 0, method, path }
    );
    if (notifyOnError ?? shouldNotifyGlobalError(method, 0)) {
      dispatchPortalError(networkError, { method, path, fallback: "Unable to reach the server. Please check your connection and try again." });
    }
    throw networkError;
  }
  if (!res.ok) {
    const data = await readResponsePayload(res).catch(() => null);
    const error = buildPortalError(res, data);
    if (notifyOnError ?? shouldNotifyGlobalError(method, res.status)) {
      dispatchPortalError(error, { method, path });
    }
    throw error;
  }

  const data = await readResponsePayload(res);
  return data;
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
  publicNotices: () => request("/notices/public", { skipAuth: true }),
  publicApprovedHighlights: (params = {}) =>
    request(`/applications/public-approved-highlights${toQueryString(params)}`, { skipAuth: true }),
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
