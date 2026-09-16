// @vitest-environment happy-dom
import { RepositoryPullRequestPublication } from "@web/components/source-control/repository/publication";
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";

const mocks = vi.hoisted(() => ({
  publish: { mutateAsync: vi.fn(), isPending: false, error: null },
  generate: { mutateAsync: vi.fn(), isPending: false, error: null, data: undefined },
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<object>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@web/api/prs/queries", () => ({
  useGitHubConnection: () => ({
    data: {
      status: "connected",
      login: "octocat",
      device_authorization: null,
      error_message: null,
    },
    isError: false,
  }),
  useRepositoryPullRequestPreview: () => ({
    data: {
      revision: "captured",
      publishability: {
        blocker: null,
        repository: "acme/repo",
        base_ref: "main",
        head_ref: "main",
        changed_files: 1,
        additions: 1,
        deletions: 0,
        dirty: false,
      },
    },
    isError: false,
  }),
}));
vi.mock("@web/api/prs/mutations", () => ({
  useConnectGitHub: () => ({ mutate: vi.fn(), isPending: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.publish.mutateAsync.mockResolvedValue({ id: "pr-created", number: 42 });
  mocks.generate.mutateAsync.mockResolvedValue({
    subject: { type: "feat", scope: "files", summary: "describe project changes" },
    body: "Generated description",
    branch: "feat/project",
    commit_body: null,
    generator: { runtime: "claude", model: null, effort: null },
  });
});

it("uses Generate PR to publish in ready mode with the captured checkout and target", async () => {
  const onPublished = vi.fn();
  const view = await mountWithQuery(
    <RepositoryPullRequestPublication
      repositoryId="repo-1"
      baseRef="main"
      revision="initial"
      publish={mocks.publish}
      generate={mocks.generate}
      onPublished={onPublished}
    />,
  );
  const button = findButton("Generate PR");
  expect(button?.disabled).toBe(false);
  await act(async () => button?.click());
  expect(mocks.publish.mutateAsync).toHaveBeenCalledExactlyOnceWith({
    mode: "ready",
    revision: "captured",
    base_ref: "main",
  });
  expect(mocks.generate.mutateAsync).not.toHaveBeenCalled();
  expect(onPublished).toHaveBeenCalledOnce();
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/pull-requests/$pullRequestId/diff",
    params: { pullRequestId: "pr-created" },
  });
  await view.cleanup();
});

it("reuses Customize PR to generate editable metadata and publishes the human edit", async () => {
  const view = await mountWithQuery(
    <RepositoryPullRequestPublication
      repositoryId="repo-1"
      baseRef="main"
      revision="initial"
      publish={mocks.publish}
      generate={mocks.generate}
      onPublished={vi.fn()}
    />,
  );
  await act(async () => findButton("Customize PR")?.click());
  await act(async () => findButton("Generate title & description with AI")?.click());
  expect(mocks.generate.mutateAsync).toHaveBeenCalledExactlyOnceWith({
    revision: "captured",
    base_ref: "main",
  });
  expect(mocks.publish.mutateAsync).not.toHaveBeenCalled();
  const summary = [...view.container.querySelectorAll("input")].find(
    (input) => input.value === "describe project changes",
  );
  if (summary === undefined) throw new Error("Generated summary missing");
  await act(async () => setInputValue(summary, "keep the human edit"));
  await act(async () => findButton("Create PR")?.click());
  expect(mocks.publish.mutateAsync).toHaveBeenCalledExactlyOnceWith({
    mode: "ready",
    revision: "captured",
    base_ref: "main",
    details: {
      subject: { type: "feat", scope: "files", summary: "keep the human edit" },
      body: "Generated description",
      head_ref: "feat/project",
    },
  });
  await view.cleanup();
});
