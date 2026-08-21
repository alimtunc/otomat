// @vitest-environment happy-dom
import type { ActivityContract, ActivitySnapshot } from "@otomat/domain";
import { queryKeys } from "@web/api/query-keys";
import { ActivityCenter } from "@web/components/shell/activity/center";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publicationActivity, runActivity } from "#support/activity";
import { stubAnimations } from "#support/animations";
import { findLabelled } from "#support/dom-queries";
import { testQueryClient } from "#support/query";
import { mountRoutedWithQuery } from "#support/router";

const listActivity = vi.fn<() => Promise<ActivitySnapshot>>();

vi.mock("@web/api/client", () => ({ daemon: { listActivity: () => listActivity() } }));

vi.mock("@web/api/runs/mutations", () => ({
  useAbortRun: () => ({ mutate: vi.fn(), isPending: false }),
}));

stubAnimations();

const UPDATED_AT = "2026-08-20T10:00:00.000Z";

const STOPPED_PUBLICATION = {
  id: "pr-1",
  kind: "pull_request_publication",
  state: "failed",
  phases: [{ key: "push", label: "Pushing the branch", state: "failed" }],
  error: { code: "github_push_failed", message: "The branch was rejected." },
  retryable: true,
  updated_at: UPDATED_AT,
} as const;

function snapshot(activities: ActivityContract[]): ActivitySnapshot {
  return { activities, observed_at: UPDATED_AT };
}

const cleanups: Array<() => Promise<void>> = [];

async function openCenter(): Promise<void> {
  const mounted = await mountRoutedWithQuery(<ActivityCenter hostLabel="otomat-vps" />);
  cleanups.push(mounted.cleanup);
  await act(async () => {
    trigger().click();
  });
}

function trigger(): HTMLElement {
  const button = document.body.querySelector<HTMLElement>("button[aria-label^='Activity']");
  if (button === null) throw new Error("activity trigger not found");
  return button;
}

function headings(): string[] {
  return [...document.body.querySelectorAll("h3")].map((node) => node.textContent?.trim() ?? "");
}

beforeEach(() => {
  listActivity.mockReset();
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

describe("ActivityCenter", () => {
  it("badges the work still in flight and names it on the trigger", async () => {
    listActivity.mockResolvedValue(
      snapshot([
        runActivity(),
        runActivity({ run_id: "run-2", id: "run:run-2", bucket: "queued", status: "queued" }),
        runActivity({
          run_id: "run-3",
          id: "run:run-3",
          bucket: "recent",
          status: "completed",
        }),
      ]),
    );

    await openCenter();

    expect(trigger().getAttribute("aria-label")).toBe("Activity — 2 in progress");
    expect(trigger().textContent).toContain("2");
  });

  it("caps the badge rather than letting a long queue widen the header", async () => {
    listActivity.mockResolvedValue(
      snapshot(
        Array.from({ length: 12 }, (_unused, index) =>
          runActivity({ run_id: `run-${index}`, id: `run:run-${index}` }),
        ),
      ),
    );

    await openCenter();

    expect(trigger().textContent).toContain("9+");
  });

  it("carries no badge while nothing needs the operator", async () => {
    listActivity.mockResolvedValue(
      snapshot([runActivity({ bucket: "recent", status: "completed" })]),
    );

    await openCenter();

    expect(trigger().getAttribute("aria-label")).toBe("Activity");
    expect(trigger().textContent).toBe("");
  });

  it("groups by state and drops the buckets with nothing in them", async () => {
    listActivity.mockResolvedValue(
      snapshot([
        runActivity(),
        runActivity({
          run_id: "run-2",
          id: "run:run-2",
          bucket: "attention",
          status: "failed",
          phase: "Review",
        }),
      ]),
    );

    await openCenter();

    expect(headings()).toEqual(["Running", "Needs attention"]);
  });

  it("links a run to its cockpit and a publication to the pull-request panel", async () => {
    listActivity.mockResolvedValue(
      snapshot([runActivity(), publicationActivity({ run_id: "run-9" })]),
    );

    await openCenter();

    const hrefs = [...document.body.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/runs/run-1");
    expect(hrefs).toContain("/runs/run-9/pr");
  });

  it("names the project and the execution host once per issue entry", async () => {
    listActivity.mockResolvedValue(snapshot([runActivity(), publicationActivity()]));

    await openCenter();

    expect(document.body.textContent?.match(/Otomat/g)).toHaveLength(1);
    expect(document.body.textContent?.match(/otomat-vps/g)).toHaveLength(1);
  });

  it("shows the failure the daemon recorded on a stopped publication", async () => {
    listActivity.mockResolvedValue(
      snapshot([publicationActivity({ bucket: "attention", operation: STOPPED_PUBLICATION })]),
    );

    await openCenter();

    expect(document.body.textContent).toContain("The branch was rejected.");
  });

  it("gathers an issue's alerts under one entry, each action still its own row", async () => {
    listActivity.mockResolvedValue(
      snapshot([
        runActivity({ bucket: "attention", status: "awaiting_human", phase: "Implement" }),
        publicationActivity({ bucket: "attention", operation: STOPPED_PUBLICATION }),
        runActivity({
          bucket: "attention",
          status: "failed",
          run_id: "run-2",
          id: "run:run-2",
          issue: { id: "i2", identifier: "ABC-2", title: "Ship more" },
        }),
      ]),
    );

    await openCenter();

    expect(
      [...document.body.querySelectorAll("section > ul > li")].map(
        (entry) => entry.querySelectorAll("a").length,
      ),
    ).toEqual([2, 1]);
    expect(
      [...document.body.querySelectorAll("a")].map((link) => link.getAttribute("href")),
    ).toEqual(["/runs/run-1", "/runs/run-1/pr", "/runs/run-2"]);
    expect(trigger().getAttribute("aria-label")).toBe("Activity — 3 in progress");
  });

  it("names its issue on every link, since the entry writes it only once", async () => {
    listActivity.mockResolvedValue(
      snapshot([
        runActivity({ bucket: "attention", status: "awaiting_human", phase: "Implement" }),
        publicationActivity({ bucket: "attention", operation: STOPPED_PUBLICATION }),
      ]),
    );

    await openCenter();

    expect(
      [...document.body.querySelectorAll("a")].map((link) => link.textContent?.includes("ABC-1")),
    ).toEqual([true, true]);
  });

  it("offers Cancel on a run still in flight and none on one that settled", async () => {
    listActivity.mockResolvedValue(
      snapshot([
        runActivity(),
        runActivity({
          run_id: "run-2",
          id: "run:run-2",
          bucket: "recent",
          status: "completed",
        }),
      ]),
    );

    await openCenter();

    const cancels = [...document.body.querySelectorAll("button")].filter(
      (button) => button.textContent?.trim() === "Cancel",
    );
    expect(cancels).toHaveLength(1);
  });

  it("shows every project the host works on, not only the selected one", async () => {
    listActivity.mockResolvedValue(
      snapshot([
        runActivity(),
        runActivity({
          run_id: "run-2",
          id: "run:run-2",
          project: { id: "p2", name: "Sidecar" },
          issue: { id: "i2", identifier: "XYZ-9", title: "Elsewhere" },
        }),
      ]),
    );

    await openCenter();

    expect(document.body.textContent).toContain("Otomat");
    expect(document.body.textContent).toContain("Sidecar");
    expect(listActivity).toHaveBeenCalledWith();
  });

  it("says so plainly when the host is doing nothing", async () => {
    listActivity.mockResolvedValue(snapshot([]));

    await openCenter();

    expect(document.body.textContent).toContain("Nothing is working");
  });

  it("opens from the keyboard and closes on Escape without leaving the page", async () => {
    listActivity.mockResolvedValue(snapshot([runActivity()]));
    const mounted = await mountRoutedWithQuery(<ActivityCenter hostLabel="otomat-vps" />);
    cleanups.push(mounted.cleanup);

    await act(async () => {
      trigger().focus();
      trigger().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      trigger().click();
    });
    expect(headings()).toEqual(["Running"]);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the activities it knows when the host stops answering", async () => {
    listActivity.mockResolvedValueOnce(snapshot([runActivity()]));
    const client = testQueryClient();

    const mounted = await mountRoutedWithQuery(<ActivityCenter hostLabel="otomat-vps" />, client);
    cleanups.push(mounted.cleanup);
    await act(async () => {
      trigger().click();
    });
    expect(headings()).toEqual(["Running"]);

    listActivity.mockRejectedValue(new Error("host unreachable"));
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.activity });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(headings()).toEqual(["Running"]);
    expect(document.body.textContent).toContain("Couldn’t refresh");
    expect(findLabelled("Activity — 1 in progress")).toBeDefined();
  });
});
