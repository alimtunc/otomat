// @vitest-environment happy-dom
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@otomat/ui";
import { act } from "react";
import { afterEach, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

Element.prototype.getAnimations = () => [];
afterEach(unmountAll);

it("closes the innermost disclosure on Escape and returns focus to its trigger", async () => {
  const container = await render(
    <Collapsible defaultOpen>
      <CollapsibleTrigger>Outer details</CollapsibleTrigger>
      <CollapsiblePanel>
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Inner details</CollapsibleTrigger>
          <CollapsiblePanel>
            <input aria-label="Inside" />
          </CollapsiblePanel>
        </Collapsible>
      </CollapsiblePanel>
    </Collapsible>,
  );
  const input = container.querySelector("input");
  await act(async () => {
    input?.focus();
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons[0]?.getAttribute("aria-expanded")).toBe("true");
  expect(buttons[1]?.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(buttons[1]);
});
