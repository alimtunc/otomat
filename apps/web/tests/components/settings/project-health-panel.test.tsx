// @vitest-environment happy-dom
import type {
  ExecutionHostProjectsEntry,
  ProjectContract,
  ProjectHealthCheck,
  ProjectHealthReport,
} from "@otomat/domain";
import { ProjectHealthPanel } from "@web/components/settings/project/health/panel";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mountWithQuery, type Mounted } from "#support/mount";

const projectHealth = vi.fn<(projectId: string) => Promise<ProjectHealthReport>>();

vi.mock("@web/api/client", () => ({
  daemon: { projectHealth: (id: string) => projectHealth(id) },
}));

const PROJECT: ProjectContract = {
  id: "p-local",
  name: "otomat",
  root_path: "/work/otomat",
  has_repository: true,
};

function check(overrides: Partial<ProjectHealthCheck> = {}): ProjectHealthCheck {
  return {
    id: "repository",
    label: "Repository",
    status: "error",
    message: "No repository is registered for this project on this host.",
    remediation: "Register the project's repository path on this host.",
    ...overrides,
  };
}

function report(
  projectId: string,
  overrides: Partial<ProjectHealthReport> = {},
): ProjectHealthReport {
  return {
    project_id: projectId,
    checked_at: "2026-09-09T10:00:00.000Z",
    status: "error",
    checks: [check()],
    ...overrides,
  };
}

function hostEntry(
  id: "local" | "remote",
  projects: ProjectContract[] | null,
): ExecutionHostProjectsEntry {
  return {
    host:
      id === "local"
        ? { id: "local", label: "Local", kind: "local" }
        : { id: "remote", label: "otomat-vps", kind: "ssh" },
    active: id === "local",
    status: null,
    projects,
  };
}

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  projectHealth.mockReset();
  delete window.otomat;
  document.body.replaceChildren();
});

async function renderPanel(
  entries: ExecutionHostProjectsEntry[],
  readProjectHealth = vi.fn(() =>
    Promise.resolve({ ok: true as const, value: report("p-remote", { status: "ready" }) }),
  ),
): Promise<HTMLElement> {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.listProjects = () => Promise.resolve(entries);
  bridge.executionHost.readProjectHealth = readProjectHealth;
  window.otomat = bridge;
  rendered = await mountWithQuery(<ProjectHealthPanel project={PROJECT} />);
  return rendered.container;
}

it("reports the project on the local host and on the VPS, each from its own daemon", async () => {
  projectHealth.mockResolvedValue(report("p-local"));
  const readProjectHealth = vi.fn(() =>
    Promise.resolve({ ok: true as const, value: report("p-remote", { status: "ready" }) }),
  );

  const container = await renderPanel(
    [
      hostEntry("local", [PROJECT]),
      hostEntry("remote", [{ ...PROJECT, id: "p-remote", root_path: "/work/otomat" }]),
    ],
    readProjectHealth,
  );

  expect(projectHealth).toHaveBeenCalledWith("p-local");
  expect(readProjectHealth).toHaveBeenCalledWith("remote", "p-remote");
  expect(container.textContent).toContain("Local");
  expect(container.textContent).toContain("otomat-vps");
  expect(container.textContent).toContain("Error");
  expect(container.textContent).toContain("Ready");
  expect(container.textContent).toContain("Register the project's repository path on this host.");
});

it("keeps the reachable host's checks when the other host does not answer", async () => {
  projectHealth.mockResolvedValue(
    report("p-local", {
      status: "ready",
      checks: [check({ status: "ready", message: "All good." })],
    }),
  );
  const readProjectHealth = vi.fn(() => Promise.resolve({ ok: false as const, message: "down" }));

  const container = await renderPanel(
    [hostEntry("local", [PROJECT]), hostEntry("remote", null)],
    readProjectHealth,
  );

  expect(container.textContent).toContain("This host did not answer");
  expect(readProjectHealth).not.toHaveBeenCalled();
  expect(container.textContent).toContain("All good.");
});

it("keeps the reachable host's checks when the other host refuses the call", async () => {
  projectHealth.mockResolvedValue(
    report("p-local", {
      status: "ready",
      checks: [check({ status: "ready", message: "All good." })],
    }),
  );
  const readProjectHealth = vi.fn(() => Promise.resolve({ ok: false as const, message: "down" }));

  const container = await renderPanel(
    [
      hostEntry("local", [PROJECT]),
      hostEntry("remote", [{ ...PROJECT, id: "p-remote", root_path: "/work/otomat" }]),
    ],
    readProjectHealth,
  );

  expect(readProjectHealth).toHaveBeenCalledWith("remote", "p-remote");
  expect(container.textContent).toContain("Couldn’t run the health check on this host");
  expect(container.textContent).toContain("All good.");
});

it("says a host holds no project for this repository instead of asking another host", async () => {
  projectHealth.mockResolvedValue(report("p-local"));

  const container = await renderPanel([hostEntry("local", [PROJECT]), hostEntry("remote", [])]);

  expect(container.textContent).toContain("Not registered on this host");
  expect(projectHealth).toHaveBeenCalledTimes(1);
});

it("re-runs every host's checks on the explicit action, skipping the hosts with none", async () => {
  projectHealth.mockResolvedValue(report("p-local"));
  const readProjectHealth = vi.fn(() =>
    Promise.resolve({ ok: true as const, value: report("p-remote", { status: "ready" }) }),
  );

  const container = await renderPanel(
    [hostEntry("local", [PROJECT]), hostEntry("remote", [])],
    readProjectHealth,
  );
  expect(projectHealth).toHaveBeenCalledTimes(1);

  expect(findButton("Run health check")).toBeDefined();
  await act(async () => {
    findButton("Run health check")?.click();
  });

  expect(projectHealth).toHaveBeenCalledTimes(2);
  expect(readProjectHealth).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Not registered on this host");
});

it("says the hosts could not be listed instead of passing one host off as all of them", async () => {
  projectHealth.mockResolvedValue(report("p-local"));
  const bridge = fakeDesktopBridge();
  bridge.executionHost.listProjects = () => Promise.reject(new Error("bridge refused"));
  window.otomat = bridge;

  rendered = await mountWithQuery(<ProjectHealthPanel project={PROJECT} />);

  expect(rendered.container.textContent).toContain("Couldn’t list this machine’s hosts");
  expect(rendered.container.textContent).toContain("Local");
  expect(rendered.container.textContent).not.toContain("otomat-vps");
});

it("reports the active host alone outside the desktop shell, and keeps doing so on the action", async () => {
  projectHealth.mockResolvedValue(report("p-local"));

  rendered = await mountWithQuery(<ProjectHealthPanel project={PROJECT} />);
  expect(rendered.container.textContent).not.toContain("Couldn’t list this machine’s hosts");

  await act(async () => {
    findButton("Run health check")?.click();
  });

  await act(async () => {});

  expect(projectHealth).toHaveBeenCalledTimes(2);
  expect(rendered.container.textContent).not.toContain("Couldn’t list this machine’s hosts");
});
