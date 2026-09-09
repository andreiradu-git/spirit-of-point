import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Editor undo/redo history.
 *
 * Every content mutation made through the inline editor (texts, lists,
 * visibility flags, typography/theme) records an entry describing how to put
 * the previous state back and how to re-apply itself. The stack lives in
 * module scope so any component can push to it, and the AdminBar renders the
 * controls.
 *
 * Saving never destroys the previous state: the value being replaced is kept
 * inside the entry, so it can be restored until the history is trimmed.
 */
export type HistoryEntry = {
  /** Short human label, e.g. `Text “studio.title”`. */
  label: string;
  /** Restore the state as it was before this change. */
  undo: () => Promise<void> | void;
  /** Re-apply this change. */
  redo: () => Promise<void> | void;
};

const MAX_HISTORY = 50;

let undoStack: HistoryEntry[] = [];
let redoStack: HistoryEntry[] = [];
let busy = false;
const listeners = new Set<() => void>();

type Snapshot = {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  busy: boolean;
};

let snapshot: Snapshot = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  busy: false,
};

function emit() {
  snapshot = {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.at(-1)?.label ?? null,
    redoLabel: redoStack.at(-1)?.label ?? null,
    busy,
  };
  for (const l of listeners) l();
}

/** Push a completed change onto the history stack. */
export function recordHistory(entry: HistoryEntry) {
  undoStack = [...undoStack, entry].slice(-MAX_HISTORY);
  redoStack = [];
  emit();
}

async function run(kind: "undo" | "redo") {
  if (busy) return;
  const from = kind === "undo" ? undoStack : redoStack;
  const entry = from.at(-1);
  if (!entry) return;
  busy = true;
  emit();
  try {
    await (kind === "undo" ? entry.undo() : entry.redo());
    if (kind === "undo") {
      undoStack = undoStack.slice(0, -1);
      redoStack = [...redoStack, entry];
    } else {
      redoStack = redoStack.slice(0, -1);
      undoStack = [...undoStack, entry];
    }
  } catch (e) {
    console.error(`${kind} failed`, e);
    alert(`${kind === "undo" ? "Undo" : "Redo"} failed: ` + (e instanceof Error ? e.message : String(e)));
  } finally {
    busy = false;
    emit();
  }
}

export const undoLastChange = () => run("undo");
export const redoLastChange = () => run("redo");

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const serverSnapshot: Snapshot = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  busy: false,
};

export function useEditHistory() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
  const undo = useCallback(() => undoLastChange(), []);
  const redo = useCallback(() => redoLastChange(), []);
  return { ...state, undo, redo };
}

/**
 * Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (and Ctrl+Y) to redo.
 * Ignored while typing into an input, textarea or inline-editable element so
 * the browser's own text undo keeps working there.
 */
export function useEditHistoryShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT")
      ) {
        return;
      }
      e.preventDefault();
      if (key === "y" || e.shiftKey) redoLastChange();
      else undoLastChange();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
