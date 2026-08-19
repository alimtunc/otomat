// @vitest-environment happy-dom
import { useInboxView } from "@web/components/reviews/use-inbox-view";
import { NO_INBOX_FILTERS } from "@web/lib/pull-request/inbox/filters";
import { act } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";

import { mount } from "#support/mount";

/** Stands in for the Reviews view: the same hook, mounted and unmounted as the route is. */
function InboxViewProbe() {
  const view = useInboxView("project-1");
  return (
    <div>
      <span data-testid="config">{JSON.stringify(view.config)}</span>
      <button
        type="button"
        data-testid="filter"
        onClick={() => view.setFilters({ ...NO_INBOX_FILTERS, link: "linked" })}
      />
      <button
        type="button"
        data-testid="collapse"
        onClick={() => view.toggleGroup("ready_to_merge")}
      />
    </div>
  );
}

const mounted = new Set<() => Promise<void>>();

async function openInbox() {
  const { container, cleanup } = await mount(<InboxViewProbe />);
  mounted.add(cleanup);
  return {
    click: async (testid: string) => {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)?.click();
      });
    },
    config: () => {
      const rendered = container.querySelector('[data-testid="config"]');
      if (rendered === null) throw new Error("the inbox probe did not render its config");
      return JSON.parse(rendered.textContent ?? "");
    },
    leave: async () => {
      mounted.delete(cleanup);
      await cleanup();
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(async () => {
  for (const cleanup of mounted) await cleanup();
  mounted.clear();
  window.localStorage.clear();
});

it("gives the inbox back the way it was left, filters and folded groups included", async () => {
  const inbox = await openInbox();
  await inbox.click("filter");
  await inbox.click("collapse");
  const left = inbox.config();
  await inbox.leave();

  const returned = await openInbox();

  expect(left.filters.link).toBe("linked");
  expect(left.collapsedGroups).toEqual(["ready_to_merge"]);
  expect(returned.config()).toEqual(left);
});
