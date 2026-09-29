// @vitest-environment happy-dom
import type { ConversationEntry, ConversationThreadEntry } from "@otomat/domain";
import { SidebarConversations } from "@web/components/shell/project-tree/conversations/list";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { stubAnimations } from "#support/animations";
import { conversationEntry, terminalConversationEntry } from "#support/conversations";
import { click, focusVisibly } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

stubAnimations();

let mounted: Mounted | undefined;
const onNavigate = vi.fn();

afterEach(async () => {
  await mounted?.cleanup();
  mounted = undefined;
  onNavigate.mockReset();
});

async function render(entries: ConversationThreadEntry[], href: string | null = null) {
  const node = <SidebarConversations entries={entries} href={href} onNavigate={onNavigate} />;
  if (mounted === undefined) mounted = await mount(node);
  else await mounted.rerender(node);
}

const step = (
  id: string,
  issue: { id: string; identifier: string; title: string },
  overrides: Partial<ConversationEntry> = {},
) =>
  conversationEntry({
    id: `conversation:${id}`,
    run_id: `run-${issue.id}`,
    step_run_id: id,
    step_status: "succeeded",
    read: true,
    issue: { ...issue, cycle: null },
    ...overrides,
  });

const crm = { id: "issue-crm", identifier: "CRM-12", title: "Refondre la fiche contact du CRM" };
const billing = { id: "issue-billing", identifier: "CRM-13", title: "Refondre la facturation" };

const ticket = (index: number) => ({
  id: `issue-${index}`,
  identifier: `CRM-${index}`,
  title: `Ticket ${index}`,
});

const headers = () => [...document.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")];
const header = (identifier: string) =>
  headers().find((button) => button.textContent?.startsWith(identifier));
const rowsOf = (button: HTMLButtonElement | undefined) =>
  [
    ...(document
      .getElementById(button?.getAttribute("aria-controls") ?? "")
      ?.querySelectorAll("button") ?? []),
  ].map((row) => row.textContent);

it("lists an issue's conversations once, under its identifier and real title", async () => {
  await render([
    step("step-review", crm, { step_name: "review", step_status: "running", read: false }),
    step("step-review-2", crm, { step_name: "Review" }),
    step("step-billing", billing, { step_name: "Review" }),
    step("step-plan", crm, { step_name: "Plan + Implement" }),
  ]);

  expect(headers().map((button) => button.textContent)).toEqual([
    "CRM-12Refondre la fiche contact du CRM",
    "CRM-13Refondre la facturation",
  ]);
  expect(header("CRM-12")?.getAttribute("aria-expanded")).toBe("true");
  expect(rowsOf(header("CRM-12"))).toEqual(["reviewUnread", "Review", "Plan + Implement"]);
  expect(document.querySelectorAll(".lucide-message-square")).toHaveLength(2);
  expect(header("CRM-13")?.getAttribute("aria-expanded")).toBe("false");
  expect(rowsOf(header("CRM-13"))).toEqual([]);
});

it("opens the step a row names and keeps the open conversation shown past the group limit", async () => {
  const oldest = step("step-6", ticket(6));
  const href = "/conversations?run=run-issue-6&step=step-6";
  await render(
    [...Array.from({ length: 6 }, (_, index) => step(`step-${index}`, ticket(index))), oldest],
    href,
  );

  expect(headers()).toHaveLength(6);
  expect(header("CRM-5")).toBeUndefined();
  expect(findButton("All project activity")).toBeDefined();
  const selected = document.querySelector('[aria-current="page"]');
  expect(selected?.textContent).toBe("Implement");

  await render(
    [{ ...oldest, step_status: "failed", updated_at: "2026-09-19T11:00:00.000Z" }],
    href,
  );
  expect(document.querySelector('[aria-current="page"]')?.textContent).toBe("Implement");

  await click("Implement");
  expect(onNavigate).toHaveBeenCalledExactlyOnceWith(href);
});

it("folds a group while its live, unread and selection signals stay on the header", async () => {
  const live = step("step-live", crm, { step_status: "running", read: false });
  await render([live], "/conversations?run=run-issue-crm&step=step-live");

  await act(async () => header("CRM-12")?.click());

  expect(header("CRM-12")?.getAttribute("aria-expanded")).toBe("false");
  expect(document.querySelector('[aria-current="page"]')).toBeNull();
  expect(header("CRM-12")?.textContent).toContain("Running");
  expect(header("CRM-12")?.textContent).toContain("Unread");
  expect(header("CRM-12")?.textContent).toContain("Holds the open conversation");

  await act(async () => header("CRM-12")?.click());
  expect(document.querySelector('[aria-current="page"]')?.textContent).toContain("Implement");
});

it("follows live changes: a thread that starts opens its group, a folded one stays folded", async () => {
  await render([step("step-crm", crm), step("step-billing", billing)]);
  expect(header("CRM-12")?.getAttribute("aria-expanded")).toBe("false");

  await render([step("step-crm", crm, { step_status: "running" }), step("step-billing", billing)]);
  expect(header("CRM-12")?.getAttribute("aria-expanded")).toBe("true");

  await act(async () => header("CRM-12")?.click());
  const fresh = { id: "issue-new", identifier: "CRM-14", title: "Nouveau ticket" };
  await render([
    step("step-new", fresh),
    step("step-crm", crm, { step_status: "running" }),
    step("step-billing", billing),
  ]);
  expect(headers().map((button) => button.textContent?.slice(0, 6))).toEqual([
    "CRM-14",
    "CRM-12",
    "CRM-13",
  ]);
  expect(header("CRM-12")?.getAttribute("aria-expanded")).toBe("false");
});

it("names an issue-less conversation from its project and shows the full title on focus", async () => {
  await render([terminalConversationEntry({ read: true }), step("step-crm", crm)]);
  expect(headers()[0]?.textContent).toBe("Otomat · no issue");

  const button = header("CRM-12");
  if (button === undefined) throw new Error("CRM-12 header missing");
  await focusVisibly(button);
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain("CRM-12 · Refondre la fiche contact du CRM"),
  );
});
