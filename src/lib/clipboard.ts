// Robust clipboard copy with fallback for mobile/insecure contexts.
// navigator.clipboard can be undefined (non-HTTPS, some in-app browsers) or
// reject (permission denied, document not focused). Never throw to callers.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn("clipboard.writeText failed, falling back", e);
  }

  // Fallback: hidden textarea + execCommand("copy")
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    console.warn("execCommand copy fallback failed", e);
    return false;
  }
}
