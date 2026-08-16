// @vitest-environment happy-dom
import type { UseQueryResult } from "@tanstack/react-query";
import { QueryList } from "@web/components/shell/query-list";
import { LOCAL_SESSION, RemoteSessionContext } from "@web/components/shell/remote-session/context";
import { afterEach, expect, it } from "vitest";

import { mount } from "#support/mount";

interface FakeQueryState {
  data?: string[];
  isError?: boolean;
}

function fakeQuery(state: FakeQueryState): UseQueryResult<string[]> {
  return {
    data: state.data,
    isError: state.isError ?? false,
    isFetching: false,
    dataUpdatedAt: Date.now(),
    refetch: () => Promise.resolve(),
  } as unknown as UseQueryResult<string[]>;
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function render(query: UseQueryResult<string[]>, settling = false) {
  const mounted = await mount(
    <RemoteSessionContext.Provider value={{ ...LOCAL_SESSION, settling }}>
      <QueryList
        query={query}
        pending={<p>pending-slot</p>}
        error={<p>error-slot</p>}
        empty={<p>empty-slot</p>}
      >
        {(items) => <p>{items.join("+")}</p>}
      </QueryList>
    </RemoteSessionContext.Provider>,
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

it("stays pending while the execution host is still settling", async () => {
  const container = await render(fakeQuery({ isError: true }), true);
  expect(container.textContent).toContain("pending-slot");
  expect(container.textContent).not.toContain("error-slot");
});

it("renders items and the empty slot from live data", async () => {
  const items = await render(fakeQuery({ data: ["run-1", "run-2"] }));
  expect(items.textContent).toContain("run-1+run-2");
  const empty = await render(fakeQuery({ data: [] }));
  expect(empty.textContent).toContain("empty-slot");
});

it("keeps retained items under a stale notice when a refresh fails", async () => {
  const container = await render(fakeQuery({ data: ["run-1", "run-2"], isError: true }));
  expect(container.textContent).toContain("run-1+run-2");
  expect(container.textContent).toContain("Couldn’t refresh");
  expect(container.textContent).not.toContain("error-slot");
});

it("keeps a retained empty list on the empty slot when a refresh fails", async () => {
  const container = await render(fakeQuery({ data: [], isError: true }));
  expect(container.textContent).toContain("empty-slot");
  expect(container.textContent).toContain("Couldn’t refresh");
});
