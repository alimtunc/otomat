// @vitest-environment happy-dom
import type { CommentFixProof } from "@otomat/domain";
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";
import { CommentFixProof as CommentFixProofCard } from "@web/components/runs/review/comment/fix-proof";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";
import { reviewComment } from "#support/review-comment";

interface FakeProofQuery {
  isPending: boolean;
  data: CommentFixProof | undefined;
  refetch: () => void;
}

let proofQuery: FakeProofQuery;
let requestedBlobs = false;

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, search }: { children?: ReactNode; search?: Record<string, unknown> }) => (
    <a data-search={JSON.stringify(search)}>{children}</a>
  ),
}));

vi.mock("@web/api/reviews/queries", () => ({
  useCommentFixProof: () => proofQuery,
}));

vi.mock("@web/components/runs/diff/files/use-file-blobs", () => ({
  useFileBlobs: () => ({
    context: null,
    isPending: false,
    error: null,
    requested: requestedBlobs,
    request: () => {
      requestedBlobs = true;
    },
  }),
}));

vi.mock("@web/components/runs/review/comment/proof-diff", () => ({
  ProofDiff: ({ patch }: { patch: string }) => <pre data-proof-patch>{patch}</pre>,
}));

const PASS = {
  agent_session_id: "sess-1",
  step_run_id: "step-1",
  step_name: "Fix review comments",
  changed_files: 2,
};

const FILE = {
  path: "notes.md",
  old_path: null,
  status: "modified" as const,
  additions: 1,
  deletions: 1,
  binary: false,
  patch: "@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n@@ -40,2 +40,2 @@\n-ten\n+TEN",
  sha: "file-sha",
};

let view: Mounted | null = null;

beforeEach(() => {
  requestedBlobs = false;
  proofQuery = { isPending: false, data: undefined, refetch: vi.fn() };
});

afterEach(async () => {
  await view?.cleanup();
  view = null;
});

it("renders only the excerpt the pass produced for this comment", async () => {
  proofQuery.data = {
    state: "reported",
    pass: PASS,
    file: FILE,
    excerpt: "@@ -1,3 +1,3 @@\n one\n-two\n+TWO",
    whole_file: false,
  };

  view = await mount(<CommentFixProofCard runId="run-1" commentId="c1" />);
  const rendered = view.container.querySelector("[data-proof-patch]")?.textContent ?? "";

  expect(rendered).toContain("+TWO");
  // The rest of the pass's delta belongs to another comment, not to this card.
  expect(rendered).not.toContain("+TEN");
  expect(view.container.textContent).toContain("Fix review comments");
});

it("offers the whole pass delta behind an explicit link", async () => {
  proofQuery.data = {
    state: "reported",
    pass: PASS,
    file: FILE,
    excerpt: "@@ -1,3 +1,3 @@\n one\n-two\n+TWO",
    whole_file: false,
  };

  view = await mount(<CommentFixProofCard runId="run-1" commentId="c1" />);

  const link = view.container.querySelector("a[data-search]");
  expect(link?.textContent).toContain("View full fix diff");
  expect(JSON.parse(link?.getAttribute("data-search") ?? "{}")).toEqual({
    scope: "session",
    session: "sess-1",
  });
});

it("states an unattributable fix instead of showing the current file", async () => {
  proofQuery.data = {
    state: "no_change",
    pass: PASS,
    reason: "This pass changed notes.md, but not the lines this comment anchors to.",
  };

  view = await mount(<CommentFixProofCard runId="run-1" commentId="c1" />);

  expect(view.container.textContent).toContain("not the lines this comment anchors to");
  expect(view.container.querySelector("[data-proof-patch]")).toBeNull();
});

it("states an unavailable proof without offering a fallback diff", async () => {
  proofQuery.data = {
    state: "unavailable",
    reason: "Git no longer holds the trees this pass was captured against.",
  };

  view = await mount(<CommentFixProofCard runId="run-1" commentId="c1" />);

  expect(view.container.textContent).toContain("no longer holds the trees");
  expect(view.container.querySelector("a[data-search]")).toBeNull();
  expect(view.container.querySelector("[data-proof-patch]")).toBeNull();
});

it("shows the proof on an addressed comment and keeps the original anchor above it", async () => {
  proofQuery.data = {
    state: "reported",
    pass: PASS,
    file: FILE,
    excerpt: "@@ -1,3 +1,3 @@\n one\n-two\n+TWO",
    whole_file: false,
  };

  view = await mount(
    <ReviewCommentCard
      target={{ kind: "run", id: "run-1" }}
      comment={reviewComment({ status: "addressed", body: "Rename this.", line: 2 })}
    />,
  );

  expect(view.container.textContent).toContain("Rename this.");
  expect(view.container.querySelector("[data-proof-patch]")).not.toBeNull();
});

it("shows no proof on a comment that is still open", async () => {
  view = await mount(
    <ReviewCommentCard target={{ kind: "run", id: "run-1" }} comment={reviewComment()} />,
  );

  expect(view.container.querySelector("[data-proof-patch]")).toBeNull();
});
