import { useEffect, useState, useCallback } from "react";

const KEY = "point-studio-edit-mode";
const EVENT = "point-studio-edit-mode-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function useEditMode() {
  const [editMode, setEditModeState] = useState(false);

  useEffect(() => {
    setEditModeState(read());
    const handler = () => setEditModeState(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setEditMode = useCallback((value: boolean) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(EVENT));
    setEditModeState(value);
  }, []);

  return { editMode, setEditMode };
}
