// @vitest-environment happy-dom
import type { ModelSelection } from "@otomat/domain";
import { ModelSelect } from "@web/components/runs/launch/model-select";
import { act, useState } from "react";
import { expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { mount } from "#support/mount";
import { modelCatalogQueryResult } from "#support/runtime-models";

type CatalogQueryResult = ReturnType<typeof modelCatalogQueryResult>;

let catalogResult: CatalogQueryResult;

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimeModels: () => catalogResult,
}));

const FAILED: CatalogQueryResult = {
  ...modelCatalogQueryResult(),
  data: undefined,
  isError: true,
  isSuccess: false,
};

const PENDING: CatalogQueryResult = {
  ...modelCatalogQueryResult(),
  data: undefined,
  isPending: true,
  isSuccess: false,
};

async function mountSelect(result: CatalogQueryResult) {
  catalogResult = result;
  return mount(
    <ModelSelect
      runtimeId="claude"
      value={{ kind: "model", id: "opus" }}
      onValueChange={vi.fn()}
    />,
  );
}

function triggerText(container: Element): string {
  return container.querySelector('[aria-label="Model"]')?.textContent ?? "";
}

it("keeps a saved identifier visible when the catalog could not be read", async () => {
  const mounted = await mountSelect(FAILED);

  expect(triggerText(mounted.container)).toContain("Custom identifier");
  expect(triggerText(mounted.container)).not.toContain("Otomat sends no model");
  expect(mounted.container.querySelector('[aria-label="Custom model identifier"]')).not.toBeNull();
  expect(mounted.container.textContent).toContain("Retry");

  await mounted.cleanup();
});

it("keeps a saved identifier visible while the catalog is still loading", async () => {
  const mounted = await mountSelect(PENDING);

  expect(triggerText(mounted.container)).toContain("Custom identifier");

  await mounted.cleanup();
});

it("shows a listed model by its catalog label rather than as a custom identifier", async () => {
  const mounted = await mountSelect(modelCatalogQueryResult());

  expect(triggerText(mounted.container)).toContain("Opus");
  expect(triggerText(mounted.container)).not.toContain("Custom identifier");
  expect(mounted.container.querySelector('[aria-label="Custom model identifier"]')).toBeNull();

  await mounted.cleanup();
});

function StatefulSelect({ initial }: { initial: ModelSelection }) {
  const [value, setValue] = useState<ModelSelection | undefined>(initial);
  return <ModelSelect runtimeId="claude" value={value} onValueChange={setValue} />;
}

it("keeps the custom field mounted while a typed identifier passes through a catalog id", async () => {
  catalogResult = modelCatalogQueryResult();
  const mounted = await mount(<StatefulSelect initial={{ kind: "model", id: "opu" }} />);
  const input = () =>
    mounted.container.querySelector<HTMLInputElement>('[aria-label="Custom model identifier"]');

  expect(input()).not.toBeNull();
  await act(async () => {
    setInputValue(input()!, "opus");
  });
  expect(input()).not.toBeNull();
  await act(async () => {
    setInputValue(input()!, "opus-4-1");
  });
  expect(input()?.value).toBe("opus-4-1");

  await mounted.cleanup();
});
