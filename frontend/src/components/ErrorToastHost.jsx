import { useEffect, useMemo, useRef, useState } from "react";
import { PORTAL_ERROR_EVENT } from "../lib/errors.js";

const AUTO_DISMISS_MS = 5500;
const DEDUPE_WINDOW_MS = 2500;

const getTitle = ({ status, method }) => {
  const normalizedMethod = String(method || "").toUpperCase();
  const parsedStatus = Number(status || 0);
  if (parsedStatus >= 500) return "Server error";
  if (normalizedMethod === "GET") return "Unable to load data";
  return "Request failed";
};

export default function ErrorToastHost() {
  const [queue, setQueue] = useState([]);
  const recentRef = useRef([]);

  useEffect(() => {
    const onPortalError = (event) => {
      const detail = event.detail || {};
      const message = String(detail.message || "").trim();
      if (!message) return;

      const signature = String(detail.signature || `${detail.status || ""}|${detail.method || ""}|${detail.path || ""}|${message}`);
      const now = Date.now();
      recentRef.current = recentRef.current.filter((item) => now - item.timestamp < DEDUPE_WINDOW_MS);

      if (recentRef.current.some((item) => item.signature === signature)) {
        return;
      }

      recentRef.current.push({ signature, timestamp: now });

      const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${now}-${Math.random().toString(16).slice(2)}`;

      setQueue((prev) => [...prev, { id, ...detail, message, title: detail.title || getTitle(detail) }]);
    };

    window.addEventListener(PORTAL_ERROR_EVENT, onPortalError);
    return () => window.removeEventListener(PORTAL_ERROR_EVENT, onPortalError);
  }, []);

  const activeToast = queue[0] || null;

  useEffect(() => {
    if (!activeToast) return undefined;
    const timer = window.setTimeout(() => {
      setQueue((prev) => prev.slice(1));
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [activeToast?.id]);

  const statusLabel = useMemo(() => {
    if (!activeToast?.status) return "";
    return `Code ${activeToast.status}`;
  }, [activeToast?.status]);

  const closeToast = () => {
    setQueue((prev) => prev.slice(1));
  };

  if (!activeToast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[80] flex justify-center sm:justify-end">
      <div
        className="pointer-events-auto w-full max-w-md animate-slide-up rounded-[24px] border border-rose-200 bg-white/95 p-4 shadow-[0_18px_48px_rgba(16,38,59,0.2)] backdrop-blur"
        role="status"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-sm font-extrabold text-rose-700">
            !
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-[color:var(--text-primary)]">
                {activeToast.title}
              </h3>
              {statusLabel && (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">
                  {statusLabel}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">
              {activeToast.message}
            </p>
          </div>
          <button
            type="button"
            className="ml-2 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-black/60 transition hover:bg-rose-50 hover:text-rose-700"
            onClick={closeToast}
            aria-label="Dismiss error"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
