// @vitest-environment happy-dom
import { LogList } from "@web/components/runs/logs/list";
import { RunTimeline } from "@web/components/runs/timeline/list";
import { describe, expect, it } from "vitest";

import { envelope } from "#support/envelope";
import { mount } from "#support/mount";

describe("run event list semantics", () => {
  it("renders timeline rows as direct children of an explicit list container", async () => {
    const { container, cleanup } = await mount(
      <RunTimeline
        events={[envelope({ type: "run.lifecycle" })]}
        steps={[]}
        state="open"
        degraded={false}
      />,
    );

    const list = container.querySelector('[role="list"]');
    expect(list?.tagName).toBe("DIV");
    expect(list?.querySelector(':scope > [role="listitem"]')).not.toBeNull();
    await cleanup();
  });

  it("renders log rows as direct children of an explicit list container", async () => {
    const { container, cleanup } = await mount(
      <LogList
        events={[envelope({ type: "runtime.log" })]}
        filter="all"
        state="open"
        degraded={false}
      />,
    );

    const list = container.querySelector('[role="list"][aria-label="Run logs"]');
    expect(list?.tagName).toBe("DIV");
    expect(list?.querySelector(':scope > [role="listitem"]')).not.toBeNull();
    await cleanup();
  });
});
