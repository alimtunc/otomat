// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinearCommentsSection } from "@web/components/issues/workspace/linear/comments";
import { act, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setTextareaValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

const getLinearComments = vi.fn();
const publishLinearComment = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: {
    getLinearComments: (id: string) => getLinearComments(id),
    publishLinearComment: (id: string, request: unknown) => publishLinearComment(id, request),
  },
}));

const ROOT = {
  id: "c-root",
  body: "Structure is ready on webflow",
  author_name: "Fawsy",
  created_at: "2026-07-21T10:00:00.000Z",
  parent_id: null,
};

const REPLY = {
  id: "c-reply",
  body: "On it",
  author_name: "Alim",
  created_at: "2026-07-21T11:00:00.000Z",
  parent_id: "c-root",
};

let rendered: Mounted | null = null;

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  vi.clearAllMocks();
  document.body.replaceChildren();
});

function withClient(node: ReactNode): ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

it("renders threads and posts a reply carrying its parent id", async () => {
  getLinearComments.mockResolvedValue([ROOT, REPLY]);
  publishLinearComment.mockResolvedValue({ draft: null, writes: [] });

  rendered = await mount(withClient(<LinearCommentsSection issueId="li" runId="r1" />));

  await vi.waitFor(() => {
    expect(document.body.textContent).toContain("Structure is ready on webflow");
    expect(document.body.textContent).toContain("On it");
  });

  await act(async () => findButton("Reply")?.click());
  const replyBox = document.body.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label^="Reply to"]',
  );
  expect(replyBox).not.toBeNull();
  if (replyBox === null) return;

  await act(async () => setTextareaValue(replyBox, "Merci !"));
  await act(async () => findButton("Post reply")?.click());

  await vi.waitFor(() => {
    expect(publishLinearComment).toHaveBeenCalledWith(
      "li",
      expect.objectContaining({ body: "Merci !", parent_id: "c-root", run_id: "r1" }),
    );
  });
});

it("posts a top-level comment without a parent", async () => {
  getLinearComments.mockResolvedValue([]);
  publishLinearComment.mockResolvedValue({ draft: null, writes: [] });

  rendered = await mount(withClient(<LinearCommentsSection issueId="li" runId={null} />));

  await vi.waitFor(() => {
    expect(
      document.body.querySelector('textarea[aria-label="Comment on the Linear issue…"]'),
    ).not.toBeNull();
  });

  const box = document.body.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Comment on the Linear issue…"]',
  );
  if (box === null) return;
  await act(async () => setTextareaValue(box, "Premier commentaire"));
  await act(async () => findButton("Comment")?.click());

  await vi.waitFor(() => {
    expect(publishLinearComment).toHaveBeenCalledWith(
      "li",
      expect.objectContaining({ body: "Premier commentaire", parent_id: null, run_id: null }),
    );
  });
});
