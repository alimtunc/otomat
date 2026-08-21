// @vitest-environment happy-dom
import type {
  DiffFileContract,
  ReviewedFileContract,
  SetReviewedFileRequest,
} from "@otomat/domain";
import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import { useDiffInteractions } from "@web/components/runs/diff/use-diff-interactions";
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diffFile } from "#support/diff-file";
import { reviewedFile } from "#support/reviewed-file";
import { mountRouted } from "#support/router";

/** The daemon answers a mark before it is shown, so the probe below plays that part synchronously. */
let answerMark: ((request: SetReviewedFileRequest) => void) | null = null;

vi.mock("@web/api/reviews/mutations", () => ({
  useSetReviewedFile: () => ({
    isPending: false,
    variables: undefined,
    mutate: (request: SetReviewedFileRequest, options?: { onSettled?: () => void }) => {
      answerMark?.(request);
      options?.onSettled?.();
    },
  }),
}));

const PATHS = ["a.ts", "b.ts", "c.ts"];

function files(shas: Record<string, string> = {}): DiffFileContract[] {
  return PATHS.map((path) => diffFile({ path, sha: shas[path] ?? `sha-${path}` }));
}

/** Stands in for the reviewer: the same interaction hook, driven the way its controls drive it. */
function ReviewedNavigationProbe({
  initial,
  marks: seeded,
}: {
  initial: DiffFileContract[];
  marks: ReviewedFileContract[];
}) {
  const [diffFiles, setDiffFiles] = useState(initial);
  const [marks, setMarks] = useState(seeded);
  answerMark = (request) => {
    setMarks((current) => [
      ...current.filter((row) => row.file_path !== request.file_path),
      reviewedFile({
        file_path: request.file_path,
        diff_sha: request.diff_sha,
        reviewed: request.reviewed,
      }),
    ]);
  };
  const interactions = useDiffInteractions({
    target: { kind: "run", id: "run-1" },
    diff: { base: "base", files: diffFiles, additions: 0, deletions: 0, sha: "diff-sha" },
    comments: [],
    reviewedFiles: marks,
    sort: "path",
    hideReviewed: false,
  });

  return (
    <ul>
      {diffFiles.map((file) => {
        const reviewed = interactions.reviewed.paths.has(file.path);
        return (
          <li key={file.path} id={diffFileDomId(file)}>
            <span
              data-testid={`state:${file.path}`}
              data-reviewed={reviewed}
              data-collapsed={interactions.collapsed.has(file.path)}
              data-active={interactions.active.path === file.path}
            />
            <button
              type="button"
              data-testid={`mark:${file.path}`}
              onClick={() => interactions.toggleReviewed(file.path, !reviewed)}
            />
            <button
              type="button"
              data-testid={`open:${file.path}`}
              onClick={() => interactions.collapsed.set(file.path, false)}
            />
          </li>
        );
      })}
      <button
        type="button"
        data-testid="repatch"
        onClick={() => setDiffFiles(files({ "b.ts": "sha-b-changed" }))}
      />
    </ul>
  );
}

const cleanups: Array<() => Promise<void>> = [];

async function openReviewer(initial = files(), marks: ReviewedFileContract[] = []) {
  const { container, cleanup } = await mountRouted(
    <ReviewedNavigationProbe initial={initial} marks={marks} />,
  );
  cleanups.push(cleanup);
  return {
    click: async (testid: string) => {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)?.click();
      });
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
    },
    state: (path: string) => {
      const marker = container.querySelector(`[data-testid="state:${path}"]`);
      if (marker === null) throw new Error(`no probe row for ${path}`);
      return {
        reviewed: marker.getAttribute("data-reviewed") === "true",
        collapsed: marker.getAttribute("data-collapsed") === "true",
        active: marker.getAttribute("data-active") === "true",
      };
    },
  };
}

beforeEach(() => {
  answerMark = null;
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

describe("reviewed navigation", () => {
  it("folds a file it marks reviewed and moves on to the next unread one", async () => {
    const reviewer = await openReviewer();

    await reviewer.click("mark:a.ts");

    expect(reviewer.state("a.ts")).toEqual({ reviewed: true, collapsed: true, active: false });
    expect(reviewer.state("b.ts")).toEqual({ reviewed: false, collapsed: false, active: true });
  });

  it("puts the next file at its start instead of resuming where the reader was", async () => {
    const reviewer = await openReviewer();

    await reviewer.click("mark:a.ts");

    expect(document.activeElement?.id).toBe(diffFileDomId({ path: "b.ts" }));
  });

  it("stays on the last file once every file is reviewed", async () => {
    const reviewer = await openReviewer();

    await reviewer.click("mark:a.ts");
    await reviewer.click("mark:b.ts");
    await reviewer.click("mark:c.ts");

    for (const path of PATHS) {
      expect(reviewer.state(path).reviewed).toBe(true);
      expect(reviewer.state(path).collapsed).toBe(true);
    }
    expect(reviewer.state("c.ts").active).toBe(true);
  });

  it("unfolds a file again when its Reviewed mark is taken back", async () => {
    const reviewer = await openReviewer();

    await reviewer.click("mark:a.ts");
    await reviewer.click("mark:a.ts");

    expect(reviewer.state("a.ts")).toEqual({ reviewed: false, collapsed: false, active: false });
  });

  it("opens with the files reviewed in an earlier visit already folded", async () => {
    const reviewer = await openReviewer(files(), [reviewedFile({ file_path: "b.ts" })]);

    expect(reviewer.state("b.ts").collapsed).toBe(true);
    expect(reviewer.state("a.ts").collapsed).toBe(false);
  });

  it("keeps Reviewed when the reader opens a folded file by hand", async () => {
    const reviewer = await openReviewer(files(), [reviewedFile({ file_path: "b.ts" })]);

    await reviewer.click("open:b.ts");

    expect(reviewer.state("b.ts")).toEqual({ reviewed: true, collapsed: false, active: false });
  });

  it("reopens a file whose patch changed, dropping the mark it was folded under", async () => {
    const reviewer = await openReviewer();
    await reviewer.click("mark:b.ts");
    expect(reviewer.state("b.ts")).toEqual({ reviewed: true, collapsed: true, active: false });

    await reviewer.click("repatch");

    expect(reviewer.state("b.ts").reviewed).toBe(false);
    expect(reviewer.state("b.ts").collapsed).toBe(false);
  });
});
