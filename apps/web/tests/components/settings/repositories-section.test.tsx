// @vitest-environment happy-dom
import type { ExecutionHostRepositoriesEntry, RepositoryContract } from "@otomat/domain";
import { RepositoriesSection } from "@web/components/settings/repositories/section";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mountWithQuery, type Mounted } from "#support/mount";

vi.mock("@web/components/shell/project-selection/use-project-switcher", () => ({
  useProjectSwitcher: () => ({ hostOptions: [], selectProject: vi.fn() }),
}));

vi.mock("@web/components/shell/project-selection/add-project-dialog", () => ({
  AddProjectDialog: () => <div data-testid="add-project-dialog" />,
}));

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  delete window.otomat;
  document.body.replaceChildren();
});

function repository(overrides: Partial<RepositoryContract> = {}): RepositoryContract {
  return {
    id: "r-local",
    project_id: "p-local",
    name: "otomat",
    root_path: "/Users/alim/code/otomat",
    remote_url: null,
    default_branch: "main",
    init_commands: [],
    available: true,
    ...overrides,
  };
}

async function renderSection(
  entries: ExecutionHostRepositoriesEntry[],
  deleteRepository = vi.fn(() => Promise.resolve({ ok: true as const })),
): Promise<HTMLElement> {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.listRepositories = () => Promise.resolve(entries);
  bridge.executionHost.deleteRepository = deleteRepository;
  window.otomat = bridge;
  rendered = await mountWithQuery(<RepositoriesSection />);
  return rendered.container;
}

it("separates the local and VPS repositories, each with its path and reachability", async () => {
  const container = await renderSection([
    {
      host: { id: "local", label: "Local", kind: "local" },
      active: true,
      status: null,
      repositories: [repository()],
    },
    {
      host: { id: "remote", label: "otomat-vps", kind: "ssh" },
      active: false,
      status: { phase: "connected", detail: null },
      repositories: [
        repository({
          id: "r-remote",
          project_id: "p-remote",
          name: "api",
          root_path: "/home/otomat/work/api",
          available: false,
        }),
      ],
    },
  ]);

  expect(container.textContent).toContain("This machine");
  expect(container.textContent).toContain("SSH tunnel");
  expect(container.textContent).toContain("/Users/alim/code/otomat");
  expect(container.textContent).toContain("/home/otomat/work/api");
  expect(container.textContent).toContain("Available");
  expect(container.textContent).toContain("Path unavailable");
});

it("says why a host could not be listed rather than showing it as empty", async () => {
  const container = await renderSection([
    {
      host: { id: "local", label: "Local", kind: "local" },
      active: true,
      status: null,
      repositories: [repository()],
    },
    {
      host: { id: "remote", label: "otomat-vps", kind: "ssh" },
      active: false,
      status: { phase: "error", code: "ssh_unreachable", detail: null },
      repositories: null,
    },
  ]);

  expect(container.textContent).toContain("otomat-vps did not answer");
  expect(container.textContent).toContain("could not be reached over SSH");
  expect(container.textContent).not.toContain("No repository on otomat-vps");
});

it("deletes on the owning host and shows that host's refusal without falling back", async () => {
  const deleteRepository = vi.fn(() =>
    Promise.resolve({
      ok: false as const,
      message: "Finish or abort this repository's active runs before deleting it.",
    }),
  );
  const container = await renderSection(
    [
      {
        host: { id: "remote", label: "otomat-vps", kind: "ssh" },
        active: false,
        status: { phase: "connected", detail: null },
        repositories: [repository({ id: "r-remote", name: "api" })],
      },
    ],
    deleteRepository,
  );

  findButton("Remove")?.click();
  await rendered?.rerender(<RepositoriesSection />);
  findButton("Delete repository and runs")?.click();
  await rendered?.rerender(<RepositoriesSection />);

  expect(deleteRepository).toHaveBeenCalledWith("remote", "r-remote");
  expect(container.textContent).toContain("active runs before deleting it");
});
