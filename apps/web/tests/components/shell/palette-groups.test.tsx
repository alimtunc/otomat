// @vitest-environment happy-dom
import type { IssueContract, ProjectContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { usePaletteGroups } from "@web/components/shell/palette/use-groups";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { issueContract } from "#support/issue";
import { mount, type Mounted } from "#support/mount";

type IssuesQuery = UseQueryResult<IssueContract[]>;

let projectId: string | undefined;
let projects: ProjectContract[];
let issues: IssuesQuery;
const seenProjectIds: (string | undefined)[] = [];

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => undefined }));

vi.mock("@web/components/shell/project-selection/use-selected", () => ({
  useSelectedProject: () => ({ projectId, projects: { data: projects } }),
}));

vi.mock("@web/api/issues/queries", () => ({
  useProjectIssues: (id: string | undefined) => {
    seenProjectIds.push(id);
    return issues;
  },
}));

function project(id: string, name: string): ProjectContract {
  return { id, name, root_path: `/tmp/${name}`, has_repository: true };
}

function issue(identifier: string, title: string, body: string | null): IssueContract {
  return issueContract({
    id: `id-${identifier}`,
    project_id: "p-otomat",
    title,
    body,
    source: "linear",
    source_external_id: `ext-${identifier}`,
    source_identifier: identifier,
    synced_at: "2026-08-12T10:00:00.000Z",
  });
}

function issuesQuery(state: Partial<IssuesQuery>): IssuesQuery {
  // SAFETY: the palette reads only these five fields, not the full query-state union.
  return {
    data: undefined,
    isError: false,
    isFetching: false,
    dataUpdatedAt: Date.now(),
    refetch: () => Promise.resolve(),
    ...state,
  } as IssuesQuery;
}

const RETRY = issue("OTO-42", "Retry queue drain", "The webhook receiver drops retries.");

function PaletteProbe({ search }: { search: string }) {
  const groups = usePaletteGroups({ search, onNewIssue: () => undefined });
  return (
    <div>
      {groups.map((group) => (
        <section key={group.id}>
          <h2>{group.heading}</h2>
          {group.notice}
          {group.commands.map((command) => (
            <p key={command.id}>{`${command.refId ?? "-"} ${command.label}`}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

let rendered: Mounted | null = null;

async function renderPalette(search: string): Promise<void> {
  await rendered?.cleanup();
  rendered = await mount(
    <ThemeProvider>
      <PaletteProbe search={search} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  projectId = "p-otomat";
  projects = [project("p-otomat", "otomat")];
  issues = issuesQuery({ data: [] });
  seenProjectIds.length = 0;
});

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  document.body.replaceChildren();
  delete window.otomat;
});

it("finds a loaded issue by its identifier, whatever the case typed", async () => {
  issues = issuesQuery({ data: [issue("OTO-7", "Rotate tokens", null), RETRY] });

  await renderPalette("oto-42");

  expect(document.body.textContent).toContain("Retry queue drain");
  expect(document.body.textContent).not.toContain("Rotate tokens");
});

it("finds a loaded issue by a term of its title and of its description", async () => {
  issues = issuesQuery({ data: [RETRY] });

  await renderPalette("QUEUE");
  expect(document.body.textContent).toContain("OTO-42");

  await renderPalette("webhook receiver");
  expect(document.body.textContent).toContain("OTO-42");
});

it("says a term is missing from the loaded issues rather than that none exist", async () => {
  issues = issuesQuery({ data: [RETRY] });

  await renderPalette("kubernetes");

  expect(document.body.textContent).toContain("No loaded issue in otomat matches “kubernetes”.");
});

it("keeps cached results and flags them as stale when the refresh fails", async () => {
  issues = issuesQuery({ data: [RETRY], isError: true });

  await renderPalette("oto-42");

  expect(document.body.textContent).toContain("Retry queue drain");
  expect(document.body.textContent).toContain("Couldn’t refresh");
});

it("offers a retry rather than an empty result when nothing is cached yet", async () => {
  const refetch = vi.fn(() => Promise.resolve());
  issues = issuesQuery({ isError: true, refetch });

  await renderPalette("oto-42");
  expect(document.body.textContent).toContain("Couldn’t load issues in otomat.");
  expect(document.body.textContent).not.toContain("Retry queue drain");

  await act(async () => {
    findButton("Retry")?.click();
  });
  expect(refetch).toHaveBeenCalledOnce();
});

it("caps the result list and says how many matches it left out", async () => {
  const many = Array.from({ length: 10 }, (_, index) =>
    issue(`OTO-${index}`, `Drain queue ${index}`, null),
  );
  issues = issuesQuery({ data: many });

  await renderPalette("drain");

  expect(document.body.textContent).toContain("Showing 8 of 10 matches");
  expect(document.body.textContent).not.toContain("Drain queue 9");
});

it("scopes the search to the selected project and drops it on switch", async () => {
  issues = issuesQuery({ data: [RETRY] });
  await renderPalette("oto-42");
  expect(seenProjectIds).toContain("p-otomat");
  expect(document.body.textContent).toContain("Issues · otomat");

  projectId = "p-other";
  projects = [project("p-other", "other")];
  issues = issuesQuery({ data: [] });
  await renderPalette("oto-42");

  expect(seenProjectIds.at(-1)).toBe("p-other");
  expect(document.body.textContent).toContain("Issues · other");
  expect(document.body.textContent).not.toContain("Retry queue drain");
});

it("names the execution host in the scope when the daemon is remote", async () => {
  window.otomat = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
  });
  issues = issuesQuery({ data: [RETRY] });

  await renderPalette("oto-42");

  expect(document.body.textContent).toContain("Issues · otomat · otomat-vps");
});
