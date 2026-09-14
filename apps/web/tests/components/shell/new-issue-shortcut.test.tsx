// @vitest-environment happy-dom
import { useNewIssueShortcut } from "@web/components/shell/use-new-issue-shortcut";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

let mounted: Mounted | null = null;
function Harness({ create }: { create: () => void }) {
  useNewIssueShortcut(create);
  return <button>Page action</button>;
}
afterEach(async () => {
  await mounted?.cleanup();
  mounted = null;
  document.body.replaceChildren();
});

it("opens immediately from the page but ignores dialogs, modal popovers and editable controls", async () => {
  const create = vi.fn();
  mounted = await mount(<Harness create={create} />);
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true }));
  });
  expect(create).toHaveBeenCalledTimes(1);
  for (const markup of [
    '<div role="dialog"><button>Inside</button></div>',
    '<div role="alertdialog"><button>Inside</button></div>',
    '<div aria-modal="true"><button>Inside</button></div>',
    "<input />",
    '<div contenteditable="true"><span>Inside</span></div>',
  ]) {
    const surface = document.createElement("div");
    surface.innerHTML = markup;
    document.body.append(surface);
    await act(async () => {
      (surface.querySelector("button, input, span") ?? surface).dispatchEvent(
        new KeyboardEvent("keydown", { key: "c", bubbles: true }),
      );
    });
    expect(create).toHaveBeenCalledTimes(1);
    surface.remove();
  }
});
