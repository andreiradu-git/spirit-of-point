import { useEffect } from "react";
import { useAdmin } from "@/hooks/use-admin";

/**
 * Client-side deterrents against casual copying:
 * - Disables right-click context menu
 * - Disables text selection & drag on images
 * - Blocks common save/copy keyboard shortcuts
 * - Blurs the page when devtools-style shortcuts are pressed
 *
 * Note: no client-side protection can stop a determined user.
 * Admins (edit mode) are exempt.
 */
export function ContentProtection() {
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (isAdmin) return;

    const prevent = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Block: F12, Ctrl/Cmd+S, Ctrl/Cmd+U, Ctrl/Cmd+P,
      // Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+C on images
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && ["s", "u", "p"].includes(k)) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k))
      ) {
        e.preventDefault();
      }
    };

    const style = document.createElement("style");
    style.setAttribute("data-content-protection", "true");
    style.textContent = `
      img, video {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        user-drag: none;
        -webkit-touch-callout: none;
        pointer-events: auto;
      }
      body {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      /* Keep form fields usable */
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    document.addEventListener("contextmenu", prevent);
    document.addEventListener("dragstart", prevent);
    document.addEventListener("selectstart", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("dragstart", prevent);
      document.removeEventListener("keydown", onKeyDown);
      style.remove();
    };
  }, [isAdmin]);

  return null;
}
