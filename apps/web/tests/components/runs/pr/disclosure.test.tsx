// @vitest-environment happy-dom
import { PullRequestForm, type PullRequestFormProps } from "@web/components/runs/pr/form";
import { pullRequestDetailFixture, pullRequestFixture } from "@web/gallery/gallery.fixtures";
import { act, useState } from "react";
import { expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { mount } from "#support/mount";

const submit = vi.fn(async () => true);

function Publication({
  pullRequest = pullRequestFixture({ number: null }),
  ...props
}: Partial<PullRequestFormProps>) {
  const [customize, setCustomize] = useState(false);
  return (
    <PullRequestForm
      pullRequest={pullRequest}
      operation={null}
      publishability={pullRequestDetailFixture(null).publishability}
      connected
      customize={customize}
      onCustomizeChange={setCustomize}
      chosenMode={undefined}
      onModeChange={() => {}}
      onSubmit={submit}
      onGenerate={async () => null}
      generationRefusal={null}
      isPending={false}
      isGenerating={false}
      {...props}
    />
  );
}

async function click(view: HTMLElement, label: string) {
  const button = [...view.querySelectorAll("button")].find((entry) =>
    entry.textContent?.includes(label),
  );
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.click());
}

it("keeps an invalid subject and its validation through closing and reopening Customize", async () => {
  const view = await mount(<Publication />);
  await click(view.container, "Customize PR");
  const input = view.container.querySelector<HTMLInputElement>(
    'input[placeholder="unify run and workflow composers"]',
  );
  if (!input) throw new Error("Missing summary");
  await act(async () => setInputValue(input, "x".repeat(100)));
  await click(view.container, "Hide PR details");
  expect(view.container.textContent).toContain("shorten");
  await click(view.container, "Customize PR");
  expect(view.container.querySelector('input[aria-invalid="true"]')).not.toBeNull();
  expect(input.value).toBe("x".repeat(100));
  await view.cleanup();
});

it("offers Draft before Customize while preserving AI creation", async () => {
  const view = await mount(<Publication pullRequest={null} />);
  await click(view.container, "Draft");
  await click(view.container, "Create draft PR with AI");
  expect(submit).toHaveBeenCalledWith({ mode: "draft" });
  await view.cleanup();
});

it("keeps generation independent of sign-in but refuses an absent workspace", async () => {
  const view = await mount(<Publication connected={false} />);
  const generate = [...view.container.querySelectorAll("button")].find((entry) =>
    entry.textContent?.includes("Generate title"),
  );
  expect(generate?.disabled).toBe(false);
  await view.cleanup();
  const blocked = await mount(
    <Publication
      publishability={{
        ...pullRequestDetailFixture(null).publishability,
        blocker: { code: "worktree_missing", message: "Workspace unavailable" },
      }}
    />,
  );
  const unavailable = [...blocked.container.querySelectorAll("button")].find((entry) =>
    entry.textContent?.includes("Generate title"),
  );
  expect(unavailable?.disabled).toBe(true);
  await blocked.cleanup();
});
