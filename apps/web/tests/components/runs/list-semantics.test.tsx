// @vitest-environment happy-dom
import { ThreadItem } from "@web/components/runs/conversation/thread-item";
import { LogList } from "@web/components/runs/logs/list";
import type { ConversationItem } from "@web/lib/conversation";
import { describe, expect, it } from "vitest";

import { envelope } from "#support/envelope";
import { mount } from "#support/mount";

const QUERY_FREE_ITEMS: ConversationItem[] = [
  { kind: "step", key: "step-1", name: "Implement" },
  { kind: "agent", key: "agent-1", event: envelope({ seq: 1 }), text: "done" },
  { kind: "milestone", key: "milestone-2", event: envelope({ seq: 2, type: "run.lifecycle" }) },
  {
    kind: "activity",
    key: "activity-3",
    events: [envelope({ seq: 3, type: "runtime.log" })],
    counts: { tools: 0, permissions: 0, thinking: 0, logs: 1, other: 0 },
  },
];

describe("run event list semantics", () => {
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

  it("gives every conversation item shape list-item semantics", async () => {
    const { container, cleanup } = await mount(
      <div role="list" aria-label="Run conversation">
        {QUERY_FREE_ITEMS.map((item) => (
          <ThreadItem key={item.key} item={item} runId="run-1" />
        ))}
      </div>,
    );

    const list = container.querySelector('[role="list"][aria-label="Run conversation"]');
    expect(list?.querySelectorAll(':scope > [role="listitem"]')).toHaveLength(
      QUERY_FREE_ITEMS.length,
    );
    expect(list?.querySelector(":scope > :not([role='listitem'])")).toBeNull();
    await cleanup();
  });
});
