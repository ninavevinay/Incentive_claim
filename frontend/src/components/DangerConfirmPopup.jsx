import { useEffect, useId, useRef } from "react";

export default function DangerConfirmPopup({
  open,
  title = "Confirm deletion",
  message = "",
  note = "This action cannot be undone.",
  confirmLabel = "Delete",
  loadingLabel = "Deleting...",
  cancelLabel = "Cancel",
  confirmText = "",
  confirmTextLabel = "Type the confirmation text",
  confirmTextPlaceholder = "",
  confirmTextValue = "",
  onConfirmTextChange,
  errorMessage = "",
  loading = false,
  onClose,
  onConfirm
}) {
  const titleId = useId();
  const messageId = useId();
  const inputRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const normalizedRequiredText = String(confirmText || "").trim().toUpperCase();
  const normalizedValue = String(confirmTextValue || "").trim().toUpperCase();
  const confirmDisabled = loading || (normalizedRequiredText && normalizedValue !== normalizedRequiredText);

  useEffect(() => {
    if (!open) return undefined;
    const focusTarget = normalizedRequiredText ? inputRef.current : confirmButtonRef.current;
    const timer = window.setTimeout(() => {
      focusTarget?.focus?.();
    }, 0);
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, loading, normalizedRequiredText, onClose]);

  if (!open) return null;

  const handleBackdropClick = () => {
    if (!loading) {
      onClose?.();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!confirmDisabled) {
      onConfirm?.();
    }
  };

  return (
    <div
      className="danger-popup-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onClick={handleBackdropClick}
    >
      <div className="danger-popup-card animate-slide-up" onClick={(event) => event.stopPropagation()}>
        <div className="danger-popup-header">
          <div className="danger-popup-icon" aria-hidden="true">
            !
          </div>
          <div className="min-w-0">
            <div className="danger-popup-kicker">Destructive action</div>
            <h3 className="danger-popup-title" id={titleId}>
              {title}
            </h3>
          </div>
        </div>

        <p className="danger-popup-message" id={messageId}>
          {message}
        </p>

        <div className="danger-popup-note">{note}</div>

        {confirmText ? (
          <div className="danger-popup-field">
            <label className="danger-popup-label">{confirmTextLabel}</label>
            <input
              ref={inputRef}
              className="input danger-popup-input"
              type="text"
              value={confirmTextValue}
              placeholder={confirmTextPlaceholder || confirmText}
              onChange={(event) => onConfirmTextChange?.(event.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        ) : null}

        {errorMessage ? <div className="danger-popup-error">{errorMessage}</div> : null}

        <form className="danger-popup-actions" onSubmit={handleSubmit}>
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button ref={confirmButtonRef} className="btn btn-danger" type="submit" disabled={confirmDisabled}>
            {loading ? loadingLabel : confirmLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
