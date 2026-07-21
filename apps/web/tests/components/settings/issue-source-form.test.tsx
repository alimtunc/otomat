// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IssueSourceForm } from "@web/components/settings/integrations/issue-source-form";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const createIssueSource = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { createIssueSource: (request: unknown) => createIssueSource(request) },
}));

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  createIssueSource.mockReset();
  document.body.replaceChildren();
});

it("does not show a source creation superseded by a newer connection", async () => {
  createIssueSource.mockRejectedValue(
    new DaemonRequestError(409, "/api/linear/sources", {
      error: "linear_request_superseded",
      message: "A newer Linear connection state replaced this request.",
    }),
  );
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  rendered = await mount(
    <QueryClientProvider client={client}>
      <IssueSourceForm
        workspace={{
          teams: [{ id: "team-1", key: "OTO", name: "Otomat" }],
          projects: [],
        }}
        projects={[{ id: "p1", name: "Local", root_path: "/tmp/local" }]}
      />
    </QueryClientProvider>,
  );

  const button = [...rendered.container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === "Map source",
  );
  button?.click();

  await vi.waitFor(() => expect(createIssueSource).toHaveBeenCalledOnce());
  expect(rendered.container.querySelector("[role='alert']")).toBeNull();
});
