import { useEffect } from "react";

export default function SubmitStatusPopup({
  open,
  type = "success",
  title = "",
  message = "",
  onClose,
  onViewApplications
}) {
  const isError = type === "error";
  const heading = title || (isError ? "Submission failed" : "Application submitted");

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="submit-popup-overlay" role="dialog" aria-modal="true" aria-live="polite" onClick={onClose}>
      <div className="submit-popup-card animate-slide-up" onClick={(event) => event.stopPropagation()}>
        <div className={`submit-popup-icon ${isError ? "is-error" : "is-success"}`} aria-hidden="true">
          {isError ? "!" : "OK"}
        </div>
        <h3 className="submit-popup-title">{heading}</h3>
        <p className="submit-popup-message">{message}</p>
        <div className="submit-popup-actions">
          {!isError && onViewApplications && (
            <button className="btn btn-primary" type="button" onClick={onViewApplications}>
              View My Applications
            </button>
          )}
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            {isError ? "Close" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
