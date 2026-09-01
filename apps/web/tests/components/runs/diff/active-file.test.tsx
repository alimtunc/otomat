// @vitest-environment happy-dom
import { useActiveDiffFile } from "@web/components/runs/diff/use-active-file";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const { navigate, search } = vi.hoisted(() => ({ navigate: vi.fn(), search: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useSearch: () => search(),
}));

let rendered: Mounted | null = null;

function Harness() {
  const active = useActiveDiffFile();
  return (
    <button type="button" onClick={() => active.select("src/b.ts")}>
      {active.path ?? "none"}
    </button>
  );
}

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  navigate.mockReset();
  search.mockReset();
});

async function click(): Promise<void> {
  await act(async () => {
    rendered?.container.querySelector("button")?.click();
  });
}

it("carries the read file in the URL without burying the page it came from or restoring its scroll", async () => {
  search.mockReturnValue({ file: undefined });
  rendered = await mount(<Harness />);

  await click();

  expect(navigate).toHaveBeenCalledTimes(1);
  const [call] = navigate.mock.calls;
  expect(call?.[0]).toMatchObject({ to: ".", replace: true, resetScroll: false });
  expect(call?.[0].search({ scope: "step" })).toEqual({
    scope: "step",
    file: "src/b.ts",
  });
});

it("navigates nowhere when the file being read is already the active one", async () => {
  search.mockReturnValue({ file: "src/b.ts" });
  rendered = await mount(<Harness />);

  await click();

  expect(navigate).not.toHaveBeenCalled();
});
