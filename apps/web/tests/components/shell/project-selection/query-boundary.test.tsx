// @vitest-environment happy-dom
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { afterEach, expect, it, vi } from "vitest";

import { mountWithQuery } from "#support/mount";

vi.mock("@web/api/daemon/queries", () => ({
  useHealth: () => ({ data: { version: "0.1.0", build: "abc1234" } }),
}));

vi.mock("@web/api/client", () => ({
  daemon: {
    daemonLogExcerpt: async () => ({ correlation_id: "req_abc123", truncated: false, entries: [] }),
  },
}));

interface FakeQueryState {
  data?: unknown;
  isError?: boolean;
}

function projectsQuery(state: FakeQueryState) {
  return {
    data: state.data,
    dataUpdatedAt: Date.now(),
    error: state.isError ? new Error("boom") : null,
    isError: state.isError ?? false,
    isFetching: false,
    refetch: () => Promise.resolve(),
  };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

async function render(query: ReturnType<typeof projectsQuery>) {
  const mounted = await mountWithQuery(
    <ProjectQueryBoundary query={query}>
      <p>projects-content</p>
    </ProjectQueryBoundary>,
  );
  cleanups.push(mounted.cleanup);
  return mounted.container;
}

it("blocks with the error report when projects never loaded", async () => {
  const container = await render(projectsQuery({ isError: true }));
  expect(container.textContent).toContain("Couldn’t load projects");
  expect(container.textContent).not.toContain("projects-content");
});

it("keeps loaded projects under a stale notice when a refresh fails", async () => {
  const container = await render(projectsQuery({ data: [{ id: "p1" }], isError: true }));
  expect(container.textContent).toContain("projects-content");
  expect(container.textContent).toContain("Couldn’t refresh");
  expect(container.textContent).not.toContain("Couldn’t load projects");
});

it("renders children with no notice while the query is healthy", async () => {
  const container = await render(projectsQuery({ data: [{ id: "p1" }] }));
  expect(container.textContent).toContain("projects-content");
  expect(container.textContent).not.toContain("Couldn’t refresh");
});
