// @vitest-environment happy-dom
import type { IssueSourceContract, LinearWorkflowState } from "@otomat/domain";
import { SourceLifecycleFields } from "@web/components/settings/integrations/source-lifecycle";
import { act, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

const reconcileSource = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    hash,
  }: {
    children?: ReactNode;
    params?: { issueId: string };
    hash?: string;
  }) => <a href={`/issues/${params?.issueId ?? ""}#${hash ?? ""}`}>{children}</a>,
}));

vi.mock("@web/api/linear/mutations", () => ({
  useReconcileIssueSource: () => ({ isPending: false, mutate: reconcileSource }),
  useUpdateIssueSource: () => ({ isPending: false, mutate: vi.fn() }),
}));

const STATES: LinearWorkflowState[] = [
  { id: "s-backlog", name: "Icebox", type: "backlog" },
  { id: "s-todo", name: "Ready", type: "unstarted" },
  { id: "s-doing", name: "Doing", type: "started" },
  { id: "s-review", name: "In Review", type: "started" },
  { id: "s-shipped", name: "Shipped", type: "completed" },
];

function source(overrides: Partial<IssueSourceContract> = {}): IssueSourceContract {
  return {
    id: "src-1",
    project_id: "p1",
    source: "linear",
    external_team_id: "team-1",
    external_team_key: "OTO",
    external_team_name: "Otomat",
    external_project_id: "",
    external_project_name: "",
    last_synced_at: null,
    lifecycle: { in_progress: null, done: null },
    lifecycle_error: null,
    ...overrides,
  };
}

const MAPPED = {
  in_progress: { id: "s-doing", name: "Doing" },
  done: { id: "s-shipped", name: "Shipped" },
};

let rendered: Mounted | null = null;

beforeEach(() => reconcileSource.mockClear());

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  document.body.replaceChildren();
});

async function renderFields(
  contract: IssueSourceContract,
  states: LinearWorkflowState[] = STATES,
): Promise<HTMLElement> {
  rendered = await mount(<SourceLifecycleFields source={contract} states={states} />);
  return rendered.container;
}

/** The listbox is portalled and only mounted while open, so one trigger is opened per assertion. */
async function optionsFor(container: HTMLElement, label: string): Promise<string[]> {
  const trigger = container.querySelector<HTMLElement>(`[aria-label='${label}']`);
  await act(async () => trigger?.click());
  return [...document.body.querySelectorAll("[role='option']")].map(
    (option) => option.textContent ?? "",
  );
}

it("offers the run phase only the states Linear types as started", async () => {
  const container = await renderFields(source());

  expect(await optionsFor(container, "Run started")).toEqual(["Not mapped", "Doing", "In Review"]);
});

it("offers the merge phase only the states Linear types as completed", async () => {
  const container = await renderFields(source());

  expect(await optionsFor(container, "Pull request merged")).toEqual(["Not mapped", "Shipped"]);
});

it("keeps a mapping Linear no longer offers for that phase visible", async () => {
  const container = await renderFields(
    source({ lifecycle: { in_progress: { id: "s-todo", name: "Ready" }, done: null } }),
  );

  expect(await optionsFor(container, "Run started")).toContain("Ready");
});

it("says an unmapped source syncs nothing, and offers no catch-up", async () => {
  const container = await renderFields(source());

  expect(container.textContent).toContain("Not configured");
  expect(findButton("Apply to open issues")).toBeUndefined();
});

it("names the phase still missing from a half-mapped source", async () => {
  const container = await renderFields(
    source({ lifecycle: { in_progress: MAPPED.in_progress, done: null } }),
  );

  expect(container.textContent).toContain("Incomplete");
  expect(container.textContent).toContain("pull request merged");
});

it("surfaces the last refused write with a way to act on it", async () => {
  const container = await renderFields(
    source({
      lifecycle: MAPPED,
      lifecycle_error: {
        issue_id: "i-1",
        write_id: "w-1",
        phase: "in_progress",
        message: "Linear rejected the API key.",
      },
    }),
  );

  expect(container.textContent).toContain("Linear rejected the API key.");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/issues/i-1#linear-write-w-1");
});

it("proposes the targeted catch-up once a confirmed mapping covers the run phase", async () => {
  const container = await renderFields(source({ lifecycle: MAPPED }));

  expect(container.textContent).toContain("Configured");
  findButton("Apply to open issues")?.click();

  expect(reconcileSource).toHaveBeenCalledWith("src-1");
});

it("reports an unreadable integration instead of an empty mapping", async () => {
  const container = await renderFields(source({ lifecycle: MAPPED }), []);

  expect(container.textContent).toContain("run mapping cannot be changed");
  expect(container.querySelector("[aria-label='Run started']")).toBeNull();
  expect(findButton("Apply to open issues")).toBeUndefined();
});
