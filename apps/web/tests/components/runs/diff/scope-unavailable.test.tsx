import { useSelector } from "@tanstack/react-store";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
// @vitest-environment happy-dom
import { DiffScopeUnavailable } from "@web/components/runs/diff/scope/unavailable";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

vi.mock("@web/components/runs/diff/prefs/popover", () => ({
  DiffPrefsPopover: () => null,
}));

let view: Mounted | null = null;

afterEach(async () => {
  await view?.cleanup();
  view = null;
});

function Harness({ reason }: { reason: string | null }) {
  const prefs = useSelector(diffPrefsStore);
  return (
    <DiffScopeUnavailable
      scopeControl={<button type="button">Pass · Fix review comments</button>}
      prefs={prefs}
      reason={reason}
    />
  );
}

it("states the daemon's own reason and keeps the scope switchable", async () => {
  view = await mount(
    <Harness reason="Git no longer holds the trees this pass was captured against." />,
  );

  expect(view.container.textContent).toContain("no longer holds the trees");
  expect(view.container.textContent).toContain("Pass · Fix review comments");
});

it("never claims a diff it does not have when the daemon gave no reason", async () => {
  view = await mount(<Harness reason={null} />);

  expect(view.container.textContent).toContain("never fabricated");
});
