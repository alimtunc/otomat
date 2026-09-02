// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSetIssueStatus } from "@web/api/issues/mutations";
import { hostKeys } from "@web/api/query-keys";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract } from "#support/issue";
import { mount, type Mounted } from "#support/mount";

const keys = hostKeys("local");

const setIssueStatus = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { setIssueStatus: (id: string, request: unknown) => setIssueStatus(id, request) },
}));

function MarkDoneProbe() {
  const setStatus = useSetIssueStatus("issue-1");
  return (
    <button type="button" onClick={() => setStatus.mutate({ status: "done" })}>
      Mark done
    </button>
  );
}

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  setIssueStatus.mockReset();
  document.body.replaceChildren();
});

it("seeds the issue it answered before every issue list refetches", async () => {
  const marked = issueContract({ id: "issue-1", status: "done" });
  setIssueStatus.mockResolvedValue(marked);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  rendered = await mount(
    <QueryClientProvider client={client}>
      <MarkDoneProbe />
    </QueryClientProvider>,
  );

  rendered.container.querySelector("button")?.click();

  await vi.waitFor(() => {
    expect(client.getQueryData(keys.issue("issue-1"))).toEqual(marked);
  });
  expect(setIssueStatus).toHaveBeenCalledWith("issue-1", { status: "done" });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: keys.issues });
});
