// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@web/api/client", () => ({
  daemon: {
    listProjects: async () => [
      {
        id: "local-default",
        name: "Local workspace",
        root_path: "/data",
        has_repository: false,
      },
      {
        id: "p-real",
        name: "otomat",
        root_path: "/repos/otomat",
        has_repository: true,
      },
    ],
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

function Probe() {
  const { projectId } = useSelectedProject();
  return <output>{projectId ?? "none"}</output>;
}

it("never resolves to the repository-less bootstrap project listed first", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
  for (let i = 0; i < 20 && container.querySelector("output")?.textContent === "none"; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  expect(container.querySelector("output")?.textContent).toBe("p-real");
});
