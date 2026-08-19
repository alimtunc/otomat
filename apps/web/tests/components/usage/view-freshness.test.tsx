// @vitest-environment happy-dom
import { UsageView } from "@web/components/usage/usage-view";
import type { UsageSearch } from "@web/lib/usage/search";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

import type { FakeQueryState } from "#support/fake-query";
import { mount } from "#support/mount";
import { usageDashboardResponse } from "#support/usage";

let dashboard: FakeQueryState = {};
let search: UsageSearch = {};

vi.mock("@web/api/usage/queries", () => ({ useUsageDashboard: () => dashboard }));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@web/components/shell/route-shell", () => ({
  RouteShell: ({ actions, children }: { actions?: ReactNode; children: ReactNode }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

vi.mock("@web/components/diagnostics/error-report", () => ({
  ErrorReport: ({ context }: { context?: string }) => <div>{context}</div>,
}));

it("keeps the loaded roll-up on screen when a refresh fails", async () => {
  dashboard = {
    isError: true,
    data: usageDashboardResponse(),
    dataUpdatedAt: Date.now(),
    isFetching: false,
    refetch: vi.fn(),
    error: new Error("refresh failed"),
  };

  const { container, cleanup } = await mount(<UsageView />);

  expect(container.textContent).toContain("Couldn’t refresh");
  expect(container.textContent).toContain("1.2k");
  expect(container.textContent).not.toContain("Couldn’t load usage");
  await cleanup();
});

it("blocks on the error report only when nothing was ever loaded", async () => {
  dashboard = { isError: true, data: undefined, refetch: vi.fn(), error: new Error("daemon down") };

  const { container, cleanup } = await mount(<UsageView />);

  expect(container.textContent).toContain("Couldn’t load usage");
  await cleanup();
});

it("waits on its skeleton rather than an empty dashboard", async () => {
  dashboard = { isPending: true, data: undefined, refetch: vi.fn() };

  const { container, cleanup } = await mount(<UsageView />);

  expect(container.textContent).not.toContain("No usage recorded yet");
  expect(container.querySelector("table")).toBeNull();
  await cleanup();
});

it("separates a window nothing matched from a host that never reported", async () => {
  const empty = usageDashboardResponse({
    totals: {
      figures: {
        turns: 0,
        unreadable_turns: 0,
        input_tokens: { value: null, reported_turns: 0 },
        output_tokens: { value: null, reported_turns: 0 },
        cost_usd: { value: null, reported_turns: 0 },
      },
      runs: 0,
      steps: 0,
      duration: { total_ms: null, measured_runs: 0, unmeasured_runs: 0 },
    },
    daily: [],
    projects: [],
    emitters: [],
    runs: [],
  });
  dashboard = { data: empty, isError: false, isFetching: false, refetch: vi.fn() };
  search = {};

  const narrowed = await mount(<UsageView />);
  expect(narrowed.container.textContent).toContain("No usage matches these filters");
  await narrowed.cleanup();

  search = { period: "all" };
  const whole = await mount(<UsageView />);
  expect(whole.container.textContent).toContain("No usage recorded yet");
  await whole.cleanup();
});
