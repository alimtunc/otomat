// @vitest-environment happy-dom
import { useUnsavedChangesGuard } from "@web/components/files/use-unsaved-changes-guard";
import { confirmContextNavigation } from "@web/lib/context-navigation";
import { act, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { mount } from "#support/mount";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
function EditorProbe() {
  const [dirty, setDirty] = useState(true);
  useUnsavedChangesGuard(dirty, () => setDirty(false));
  return <span>{dirty ? "Unsaved" : "Discarded"}</span>;
}
it("refuses project or tab changes before they can remove unsaved content", async () => {
  const confirm = vi.fn().mockReturnValue(false);
  vi.stubGlobal("confirm", confirm);
  const view = await mount(<EditorProbe />);
  let allowed = true;
  await act(async () => {
    allowed = confirmContextNavigation();
  });
  expect(allowed).toBe(false);
  expect(view.container.textContent).toBe("Unsaved");
  confirm.mockReturnValue(true);
  await act(async () => {
    allowed = confirmContextNavigation();
  });
  expect(allowed).toBe(true);
  expect(view.container.textContent).toBe("Discarded");
  await act(async () => {
    allowed = confirmContextNavigation();
  });
  expect(confirm).toHaveBeenCalledTimes(2);
  await view.cleanup();
  expect(confirmContextNavigation()).toBe(true);
});
