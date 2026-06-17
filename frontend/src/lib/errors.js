const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_ERROR_MESSAGE = "Unable to reach the server. Please check your connection and try again.";

const STATUS_MESSAGES = {
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested item was not found.",
  413: "The uploaded file is too large. Please upload a smaller file.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "The server had a problem. Please try again later."
};

export const PORTAL_ERROR_EVENT = "portal:api-error";

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toText = (value) => {
  const text = String(value ?? "").trim();
  return text ? [text] : [];
};

const flattenDetail = (value) => {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return toText(value);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenDetail(item));
  }
  if (!isPlainObject(value)) return [];

  const messages = [];
  if ("detail" in value) {
    messages.push(...flattenDetail(value.detail));
  }

  Object.entries(value).forEach(([key, nested]) => {
    if (key === "detail") return;
    const nestedMessages = flattenDetail(nested);
    if (nestedMessages.length === 0) return;
    if (nestedMessages.length === 1) {
      messages.push(`${key}: ${nestedMessages[0]}`);
      return;
    }
    nestedMessages.forEach((message) => {
      messages.push(`${key}: ${message}`);
    });
  });

  return messages;
};

export class PortalError extends Error {
  constructor(message, { status = null, detail = null, method = "", path = "" } = {}) {
    super(message || DEFAULT_ERROR_MESSAGE);
    this.name = "PortalError";
    this.status = status;
    this.detail = detail;
    this.method = method;
    this.path = path;
  }
}

export function getStatusMessage(status) {
  const parsedStatus = Number(status);
  return STATUS_MESSAGES[parsedStatus] || DEFAULT_ERROR_MESSAGE;
}

export function getErrorMessage(error, fallback = DEFAULT_ERROR_MESSAGE) {
  if (!error) return fallback;

  if (typeof error === "string") {
    return error.trim() || fallback;
  }

  if (Array.isArray(error)) {
    const messages = flattenDetail(error);
    if (messages.length === 1) return messages[0];
    if (messages.length > 1) return messages.join(", ");
    return fallback;
  }

  if (error instanceof Error) {
    const text = String(error.message || "").trim();
    if (!text) return fallback;
    if (error.name === "TypeError" && /fetch/i.test(text) && !("status" in error)) {
      return NETWORK_ERROR_MESSAGE;
    }
    return text;
  }

  if (isPlainObject(error)) {
    const status = Number(error.status);
    if (Number.isFinite(status) && STATUS_MESSAGES[status]) {
      return STATUS_MESSAGES[status];
    }

    const directDetail = flattenDetail(error.detail);
    if (directDetail.length === 1) return directDetail[0];
    if (directDetail.length > 1) return directDetail.join(", ");

    const flattened = flattenDetail(error);
    if (flattened.length === 1) return flattened[0];
    if (flattened.length > 1) return flattened.join(", ");
  }

  return fallback;
}

export async function readResponsePayload(response) {
  const rawText = await response.text().catch(() => "");
  const text = String(rawText || "").trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function buildPortalError(response, payload) {
  const status = Number(response?.status ?? 0);
  const messageFromPayload = getErrorMessage(payload, getStatusMessage(status));
  return new PortalError(messageFromPayload, { status, detail: payload });
}

export function shouldNotifyGlobalError(method, status) {
  const normalizedMethod = String(method || "GET").trim().toUpperCase();
  const parsedStatus = Number(status ?? 0);
  return normalizedMethod === "GET" || !parsedStatus || parsedStatus >= 500;
}

export function dispatchPortalError(error, meta = {}) {
  if (typeof window === "undefined") return;

  const status = Number(error?.status ?? meta.status ?? 0) || null;
  const method = String(meta.method || error?.method || "").trim().toUpperCase();
  const path = String(meta.path || error?.path || "").trim();
  const message = getErrorMessage(error, meta.fallback);
  const signature = [status || "", message].join("|");

  window.dispatchEvent(
    new CustomEvent(PORTAL_ERROR_EVENT, {
      detail: {
        message,
        status,
        method,
        path,
        title: meta.title || "",
        signature
      }
    })
  );
}
