// @vitest-environment happy-dom
import { Spinner } from "@otomat/ui";
import { afterEach, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

afterEach(unmountAll);

it("names a standalone mark and lets visible context name a labelled loader", async () => {
  const container = await render(
    <>
      <Spinner label="Syncing issues" />
      <Spinner motion="breathe" size={28}>
        Preparing pull request…
      </Spinner>
    </>,
  );
  const [standalone, contextual] = container.querySelectorAll("output");
  expect(standalone?.getAttribute("aria-label")).toBe("Syncing issues");
  expect(standalone?.textContent).toBe("");
  expect(standalone?.querySelectorAll(".otomat-orbit .otomat-orbit-ring")).toHaveLength(2);
  expect(contextual?.querySelector(".otomat-loader")).not.toBeNull();
  expect(contextual?.querySelector(".otomat-orbit-ring")).toBeNull();
  expect(contextual?.textContent).toBe("Preparing pull request…");
  expect(contextual?.hasAttribute("aria-label")).toBe(false);
  expect(contextual?.querySelector("span")?.getAttribute("aria-hidden")).toBe("true");
});
