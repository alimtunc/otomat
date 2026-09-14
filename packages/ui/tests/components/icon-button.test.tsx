// @vitest-environment happy-dom
import { Icon, IconButton, Popover, PopoverContent, PopoverTrigger } from "@otomat/ui";
import { act } from "react";
import { afterEach, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

afterEach(unmountAll);

it("names an icon on keyboard focus and still opens its composed popover", async () => {
  const container = await render(
    <Popover>
      <PopoverTrigger render={<IconButton label="Session details" icon={<Icon name="info" />} />} />
      <PopoverContent>Requested model: Astra</PopoverContent>
    </Popover>,
  );
  const button = container.querySelector("button");
  if (button === null) throw new Error("Missing session details button");
  await act(async () => button.focus());
  expect(document.body.textContent).toContain("Session details");
  expect(button.getAttribute("aria-label")).toBe("Session details");
  await act(async () => button.click());
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(document.body.textContent).toContain("Requested model: Astra");
  expect(container.querySelectorAll("button")).toHaveLength(1);
});
