// @vitest-environment happy-dom
import { PageBar } from "@otomat/ui";
import { afterEach, describe, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

function header(container: HTMLElement): HTMLElement {
  const element = container.querySelector("header");
  if (element === null) throw new Error("PageBar rendered no header");
  return element;
}

function columns(container: HTMLElement): string[] {
  const template = /grid-cols-\[([^\]]+)]/.exec(header(container).className)?.[1];
  if (template === undefined) throw new Error("PageBar declares no column template");
  return template.split("_");
}

async function renderBar(): Promise<HTMLElement> {
  return await render(
    <PageBar
      leading={<span>Runs / OTO-161 · Anchor the cockpit tabs / Run</span>}
      tabs={<nav aria-label="Run cockpit tabs">Conversation</nav>}
      trailing={<span>Activity</span>}
    />,
  );
}

describe("PageBar", () => {
  afterEach(async () => {
    await unmountAll();
  });

  it("orders the zones leading, tabs, then trailing", async () => {
    const container = await renderBar();
    const zones = [...header(container).children].map((zone) => zone.textContent);
    expect(zones).toEqual([
      "Runs / OTO-161 · Anchor the cockpit tabs / Run",
      "Conversation",
      "Activity",
    ]);
  });

  it("keeps the leading column the only flexible track, floored at zero", async () => {
    const [leadingColumn, ...rightOfLeading] = columns(await renderBar());
    expect(leadingColumn).toBe("minmax(0,1fr)");
    expect(rightOfLeading).toEqual(["auto", "auto"]);
  });

  it("gives the leading zone the clip its truncation needs", async () => {
    const leading = header(await renderBar()).firstElementChild;
    expect(leading?.className.split(" ")).toContain("min-w-0");
  });
});
