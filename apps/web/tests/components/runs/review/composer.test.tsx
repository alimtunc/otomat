// @vitest-environment happy-dom
import type { DiffFileContract, ReviewCommentDestination } from "@otomat/domain";
import { ReviewCommentComposer } from "@web/components/runs/review/comment/composer";
import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { findButton, findLabelled } from "#support/dom-queries";
import { mount } from "#support/mount";

const FILE: DiffFileContract = {
  path: "notes.md",
  old_path: null,
  status: "modified",
  additions: 2,
  deletions: 1,
  binary: false,
  patch: ["@@ -1,3 +1,4 @@", " alpha", "-beta", "+bravo", "+charlie", " gamma"].join("\n"),
  sha: "file-sha",
};

const WITH_PR = { pr_review: true, reason: "Pull request #7 is open for review." };
const WITHOUT_PR = { pr_review: false, reason: "This run has no pull request yet." };

interface ComposerOptions {
  line?: number | null;
  fromLine?: number | null;
  destinations?: { pr_review: boolean; reason: string };
  preferredDestination?: ReviewCommentDestination;
  onSubmit?: (comment: unknown) => Promise<void>;
  onMoveEdge?: (edge: "start" | "end", by: 1 | -1) => void;
}

/** Stands in for the gutter, which owns the range an open composer is anchored on. */
function RangeOwner(options: ComposerOptions) {
  const [range, setRange] = useState({
    fromLine: options.fromLine ?? null,
    line: options.line === undefined ? 4 : options.line,
  });
  return (
    <ReviewCommentComposer
      file={FILE}
      side="new"
      line={range.line}
      fromLine={range.fromLine}
      destinations={options.destinations ?? WITHOUT_PR}
      preferredDestination={options.preferredDestination ?? "agent"}
      onMoveEdge={(edge, by) => {
        options.onMoveEdge?.(edge, by);
        setRange((current) => {
          const start = (current.fromLine ?? current.line ?? 0) + (edge === "start" ? by : 0);
          const end = (current.line ?? 0) + (edge === "end" ? by : 0);
          return { fromLine: start, line: end };
        });
      }}
      onSubmit={options.onSubmit ?? (async () => {})}
      onClose={() => {}}
    />
  );
}

function renderComposer(options: ComposerOptions = {}) {
  return mount(<RangeOwner {...options} />);
}

function textarea(container: HTMLElement, label: string): HTMLTextAreaElement {
  const field = container.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
  if (field === null) throw new Error(`no ${label} field rendered`);
  return field;
}

async function type(field: HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("review comment composer", () => {
  it("states the file, the side and the range it is anchored on", async () => {
    const { container, cleanup } = await renderComposer({ fromLine: 2, line: 4 });

    expect(container.textContent).toContain("notes.md · lines 2–4 · head side");
    await cleanup();
  });

  it("asks the range's owner to move an edge, and shows the range it gets back", async () => {
    const onMoveEdge = vi.fn();
    const { container, cleanup } = await renderComposer({ line: 4, fromLine: 4, onMoveEdge });
    expect(container.textContent).toContain("line 4");

    await act(async () => {
      findLabelled("Move the range start up one line")?.click();
    });
    expect(onMoveEdge).toHaveBeenCalledWith("start", -1);
    expect(container.textContent).toContain("lines 3–4");

    await act(async () => {
      findLabelled("Move the range start down one line")?.click();
    });
    expect(container.textContent).toContain("line 4");
    await cleanup();
  });

  it("offers no edge to move when the anchor is the whole file", async () => {
    const { cleanup } = await renderComposer({ line: null });

    expect(findLabelled("Move the range start up one line")).toBeUndefined();
    expect(findLabelled("Move the range end down one line")).toBeUndefined();
    await cleanup();
  });

  it("prefills a suggestion with the head lines the range covers", async () => {
    const { container, cleanup } = await renderComposer({ fromLine: 2, line: 3 });

    await act(async () => {
      findButton("Suggest change")?.click();
    });

    expect(textarea(container, "Suggested replacement").value).toBe("bravo\ncharlie");
    await cleanup();
  });

  it("follows the range while the prefill is untouched, and keeps an edited one", async () => {
    const { container, cleanup } = await renderComposer({ fromLine: 3, line: 3 });

    await act(async () => {
      findButton("Suggest change")?.click();
    });
    await act(async () => {
      findLabelled("Move the range start up one line")?.click();
    });
    expect(textarea(container, "Suggested replacement").value).toBe("bravo\ncharlie");

    await type(textarea(container, "Suggested replacement"), "delta");
    await act(async () => {
      findLabelled("Move the range start up one line")?.click();
    });
    expect(textarea(container, "Suggested replacement").value).toBe("delta");
    await cleanup();
  });

  it("sends the range, the destination and the edited replacement", async () => {
    const onSubmit = vi.fn(async () => {});
    const { container, cleanup } = await renderComposer({ fromLine: 2, line: 3, onSubmit });

    await act(async () => {
      findButton("Suggest change")?.click();
    });
    await type(textarea(container, "Suggested replacement"), "delta\nepsilon");
    await type(textarea(container, "Review comment"), "rename these");
    await act(async () => {
      findButton("Add comment")?.click();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      side: "new",
      start_line: 2,
      line: 3,
      body: "rename these",
      destination: "agent",
      suggestion: "delta\nepsilon",
    });
    await cleanup();
  });

  it("keeps Comment mode and says why when the range cannot carry a suggestion", async () => {
    const { container, cleanup } = await renderComposer({ line: null });

    const suggest = findButton("Suggest change");
    expect(suggest?.hasAttribute("disabled")).toBe(true);
    expect(container.querySelector('textarea[aria-label="Suggested replacement"]')).toBeNull();
    await cleanup();
  });

  it("offers no PR destination without a pull request, and explains the fallback", async () => {
    const { container, cleanup } = await renderComposer({
      destinations: WITHOUT_PR,
      preferredDestination: "pr_review",
    });

    expect(findButton("PR review")?.hasAttribute("disabled")).toBe(true);
    expect(findButton("Agent")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Falling back to Agent");
    expect(container.textContent).toContain("no pull request yet");
    await cleanup();
  });

  it("honours the PR-review default once a pull request exists", async () => {
    const onSubmit = vi.fn(async () => {});
    const { container, cleanup } = await renderComposer({
      destinations: WITH_PR,
      preferredDestination: "pr_review",
      onSubmit,
    });

    expect(findButton("PR review")?.getAttribute("aria-pressed")).toBe("true");
    await type(textarea(container, "Review comment"), "on the PR");
    await act(async () => {
      findButton("Comment on the PR")?.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "pr_review", suggestion: null }),
    );
    await cleanup();
  });
});
