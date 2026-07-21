// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLinearWorkspace } from "@web/api/linear/queries";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const getLinearWorkspace = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: { getLinearWorkspace: () => getLinearWorkspace() },
}));

function WorkspaceProbe() {
  const [workspaceId, setWorkspaceId] = useState("workspace-a");
  const workspace = useLinearWorkspace(workspaceId);
  return (
    <>
      <button type="button" onClick={() => setWorkspaceId("workspace-b")}>
        Switch
      </button>
      <span>{workspace.data?.teams[0]?.name ?? "Loading"}</span>
    </>
  );
}

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  getLinearWorkspace.mockReset();
  document.body.replaceChildren();
});

it("does not reuse workspace data after the connection identity changes", async () => {
  let resolveWorkspaceB!: (value: {
    teams: { id: string; key: string; name: string }[];
    projects: [];
  }) => void;
  getLinearWorkspace
    .mockResolvedValueOnce({
      teams: [{ id: "team-a", key: "A", name: "Workspace A" }],
      projects: [],
    })
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWorkspaceB = resolve;
      }),
    );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rendered = await mount(
    <QueryClientProvider client={client}>
      <WorkspaceProbe />
    </QueryClientProvider>,
  );
  await vi.waitFor(() => expect(rendered?.container.textContent).toContain("Workspace A"));

  rendered.container.querySelector("button")?.click();

  await vi.waitFor(() => expect(rendered?.container.textContent).toContain("Loading"));
  expect(rendered.container.textContent).not.toContain("Workspace A");
  resolveWorkspaceB({
    teams: [{ id: "team-b", key: "B", name: "Workspace B" }],
    projects: [],
  });
  await vi.waitFor(() => expect(rendered?.container.textContent).toContain("Workspace B"));
});
