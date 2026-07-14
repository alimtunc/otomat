// @vitest-environment happy-dom
import {
  configureDiffCommentButtons,
  diffCommentButtonLabel,
  handleCommentButtonKeyDown,
  isActivationKey,
} from "@web/components/runs/diff/file-card.utils";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { describe, expect, it } from "vitest";

function diffRootFixture(side: "new" | "old", lineNumber: string): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <table><tbody><tr class="diff-line">
      <td><span data-line-new-num>${lineNumber}</span></td>
      <td>
        <div class="diff-add-widget-wrapper" data-add-widget="${side}">
          <button class="diff-add-widget"></button>
        </div>
      </td>
    </tr></tbody></table>
  `;
  return root;
}

function widgetButton(root: ParentNode): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(".diff-add-widget");
  if (button === null) throw new Error("fixture is missing the widget button");
  return button;
}

describe("diff comment trigger accessibility", () => {
  it("gives each new-side trigger a line-specific accessible name", () => {
    expect(diffCommentButtonLabel("src/index.ts", 14)).toBe("Add comment on src/index.ts line 14");
  });

  it("annotates the new-side button with native button semantics off real markup", () => {
    const root = diffRootFixture("new", "14");

    configureDiffCommentButtons(root, "src/index.ts");

    const button = widgetButton(root);
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Add comment on src/index.ts line 14");
  });

  it("leaves old-side buttons untouched", () => {
    const root = diffRootFixture("old", "14");

    configureDiffCommentButtons(root, "src/index.ts");

    expect(widgetButton(root).hasAttribute("aria-label")).toBe(false);
  });

  it("skips buttons whose row has no parseable new-side line number", () => {
    const root = diffRootFixture("new", "not-a-line");

    configureDiffCommentButtons(root, "src/index.ts");

    expect(widgetButton(root).hasAttribute("aria-label")).toBe(false);
  });

  it("activates the trigger with the keyboard through the capture handler", () => {
    const root = diffRootFixture("new", "14");
    root.addEventListener("keydown", (event) => {
      handleCommentButtonKeyDown(event as unknown as ReactKeyboardEvent<HTMLDivElement>);
    });
    const button = widgetButton(root);
    let mousedowns = 0;
    button.addEventListener("mousedown", () => {
      mousedowns += 1;
    });

    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    button.dispatchEvent(enter);
    expect(mousedowns).toBe(1);
    expect(enter.defaultPrevented).toBe(true);

    const arrow = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(arrow);
    expect(mousedowns).toBe(1);
    expect(arrow.defaultPrevented).toBe(false);
  });

  it.each(["Enter", " "])("treats %j as an activation key", (key) => {
    expect(isActivationKey(key)).toBe(true);
  });

  it("ignores unrelated keys", () => {
    expect(isActivationKey("ArrowDown")).toBe(false);
  });
});
