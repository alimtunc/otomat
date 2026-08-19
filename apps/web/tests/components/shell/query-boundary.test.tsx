// @vitest-environment happy-dom
import type { UseQueryResult } from "@tanstack/react-query";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { LOCAL_SESSION, RemoteSessionContext } from "@web/components/shell/remote-session/context";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";

interface FakeQueryState {
  data?: string;
  isError?: boolean;
  refetch?: () => void;
}

function fakeQuery(state: FakeQueryState): UseQueryResult<string> {
  // SAFETY: QueryBoundary reads only these five fields, not the full query-state union.
  return {
    data: state.data,
    isError: state.isError ?? false,
    isFetching: false,
    dataUpdatedAt: Date.now(),
    refetch: state.refetch ?? (() => Promise.resolve()),
  } as UseQueryResult<string>;
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function render(query: UseQueryResult<string>, staleData?: "keep" | "block") {
  const mounted = await mount(
    <QueryBoundary
      query={query}
      pending={<p>pending-slot</p>}
      error={<p>error-slot</p>}
      staleData={staleData}
    >
      {(data) => <p>{data}</p>}
    </QueryBoundary>,
  );
  cleanups.push(mounted.cleanup);
  return mounted.container;
}

it("renders the pending slot before any data exists", async () => {
  const container = await render(fakeQuery({}));
  expect(container.textContent).toContain("pending-slot");
});

it("renders the error slot when the first load fails with nothing to show", async () => {
  const container = await render(fakeQuery({ isError: true }));
  expect(container.textContent).toContain("error-slot");
});

it("keeps retained data under a stale notice when a refresh fails", async () => {
  const container = await render(fakeQuery({ data: "issue-42", isError: true }));
  expect(container.textContent).toContain("issue-42");
  expect(container.textContent).toContain("Couldn’t refresh");
  expect(container.textContent).not.toContain("error-slot");
});

it("retries a failed refresh from the stale notice", async () => {
  const refetch = vi.fn(() => Promise.resolve());
  await render(fakeQuery({ data: "issue-42", isError: true, refetch }));
  const retry = findButton("Retry");
  expect(retry).toBeDefined();
  await act(async () => {
    retry?.click();
  });
  expect(refetch).toHaveBeenCalledTimes(1);
});

it("blocks retained data with the error slot when stale data is opted out", async () => {
  const container = await render(fakeQuery({ data: "issue-42", isError: true }), "block");
  expect(container.textContent).toContain("error-slot");
  expect(container.textContent).not.toContain("issue-42");
});

it("stays pending while the execution host is still settling", async () => {
  const mounted = await mount(
    <RemoteSessionContext.Provider value={{ ...LOCAL_SESSION, settling: true }}>
      <QueryBoundary
        query={fakeQuery({ isError: true })}
        pending={<p>pending-slot</p>}
        error={<p>error-slot</p>}
      >
        {(data) => <p>{data}</p>}
      </QueryBoundary>
    </RemoteSessionContext.Provider>,
  );
  cleanups.push(mounted.cleanup);

  expect(mounted.container.textContent).toContain("pending-slot");
  expect(mounted.container.textContent).not.toContain("error-slot");
});

it("renders data with no notice while the query is healthy", async () => {
  const container = await render(fakeQuery({ data: "issue-42" }));
  expect(container.textContent).toContain("issue-42");
  expect(container.textContent).not.toContain("Couldn’t refresh");
});
