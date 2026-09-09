import { test, expect } from "vitest";
import { recordHistory, undoLastChange, redoLastChange } from "@/hooks/use-edit-history";

test("undo/redo restore state", async () => {
  let v = "a";
  const prev = v; v = "b";
  recordHistory({ label: "t", undo: () => { v = prev; }, redo: () => { v = "b"; } });
  await undoLastChange();
  expect(v).toBe("a");
  await redoLastChange();
  expect(v).toBe("b");
});
