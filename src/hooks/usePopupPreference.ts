import { useCallback, useState } from "react";

const PREFIX = "popup-dismissed-forever:";

export function getPermanentlyDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

export function setPermanentlyDismissed(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem(PREFIX + key, "1");
    else localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * State holder for the "Don't show again" checkbox inside a popup.
 * Call `commit()` when the user dismisses the popup to persist the choice.
 */
export function useDontShowAgain(key: string) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const commit = useCallback(() => {
    if (dontShowAgain) setPermanentlyDismissed(key, true);
  }, [dontShowAgain, key]);
  return { dontShowAgain, setDontShowAgain, commit };
}
