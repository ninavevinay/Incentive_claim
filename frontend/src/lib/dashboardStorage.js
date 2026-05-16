export const getStoredMenuSelection = (storageKey, fallbackValue, validOptions) => {
  if (typeof window === "undefined") return fallbackValue;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return fallbackValue;
    if (Array.isArray(validOptions) && validOptions.length > 0) {
      return validOptions.includes(saved) ? saved : fallbackValue;
    }
    return saved;
  } catch {
    return fallbackValue;
  }
};

export const setStoredMenuSelection = (storageKey, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, String(value ?? ""));
  } catch {
    // Ignore storage errors (private mode or blocked storage).
  }
};
