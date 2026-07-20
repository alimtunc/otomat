// @vitest-environment happy-dom
import type { DiffFileContract } from "@otomat/domain";
import { revealAndFocus } from "@web/components/runs/diff/diff-nav";
import { diffFileDomId } from "@web/components/runs/diff/file-card.utils";
import { useDiffKeyboardNav } from "@web/components/runs/diff/use-diff-keyboard-nav";
import { act, useState } from "react";
import { describe, expect, it } from "vitest";

import { diffLineRow } from "#support/diff-dom";
import { mount } from "#support/mount";

function file(path: string): DiffFileContract {
  return {
    path,
    old_path: null,
    status: "modified",
    additions: 1,
    deletions: 0,
    binary: false,
    patch: "",
    sha: `sha-${path}`,
  };
}

const files = [file("a.ts"), file("b.ts")];

/** Context rows separate the changed rows so each `+` starts its own contiguous block. */
function cardMarkup(path: string, ids: readonly string[]): string {
  const rows = ids.flatMap((id, index) => [
    diffLineRow(" ", `${path}-ctx-${index}`),
    diffLineRow("+", id),
  ]);
  return `<table>${rows.join("")}</table>`;
}

function Harness({ collapsed }: { collapsed: string | null }) {
  const [activePath, setActivePath] = useState<string | null>(null);
  useDiffKeyboardNav({
    enabled: true,
    files,
    activePath,
    // Mirrors RunDiffView: selecting a file reveals and focuses its card.
    onJumpToFile: (next) => {
      setActivePath(next.path);
      const card = document.getElementById(diffFileDomId(next));
      if (card !== null) revealAndFocus(card, "start");
    },
    onToggleReviewed: () => {},
    onExit: () => {},
  });
  return (
    <div>
      {files.map((entry) => (
        <section
          key={entry.path}
          id={diffFileDomId(entry)}
          dangerouslySetInnerHTML={{
            __html:
              collapsed === entry.path
                ? ""
                : cardMarkup(entry.path, [`${entry.path}-1`, `${entry.path}-2`]),
          }}
        />
      ))}
    </div>
  );
}

async function press(key: string): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("useDiffKeyboardNav change-block cursor", () => {
  it("enters the jumped-to file on the first n, not the first file in the diff", async () => {
    const { cleanup } = await mount(<Harness collapsed={null} />);

    await press("j");
    await press("j");
    await press("n");

    expect(document.activeElement?.id).toBe("b.ts-1");
    await cleanup();
  });

  it("clamps at the last change of the active file instead of crossing into the next", async () => {
    const { cleanup } = await mount(<Harness collapsed={null} />);

    await press("n");
    await press("n");
    await press("n");

    expect(document.activeElement?.id).toBe("a.ts-2");
    await cleanup();
  });

  it("does not leave the file when stepping back from its first change", async () => {
    const { cleanup } = await mount(<Harness collapsed={null} />);

    await press("j");
    await press("j");
    await press("n");
    await press("p");

    expect(document.activeElement?.id).toBe("b.ts-1");
    await cleanup();
  });

  it("does not fall through into another file when the active file has no changes left", async () => {
    const { cleanup } = await mount(<Harness collapsed="b.ts" />);

    await press("j");
    await press("j");
    await press("n");

    expect(document.activeElement?.id).toBe(diffFileDomId({ path: "b.ts" }));
    await cleanup();
  });

  it("re-enters at the first change after leaving and returning to a file", async () => {
    const { cleanup } = await mount(<Harness collapsed={null} />);

    await press("n");
    await press("n");
    await press("j");
    await press("k");
    await press("n");

    expect(document.activeElement?.id).toBe("a.ts-1");
    await cleanup();
  });

  it("adopts the first file so j advances past it", async () => {
    const jumped: string[] = [];
    function Spy() {
      const [activePath, setActivePath] = useState<string | null>(null);
      useDiffKeyboardNav({
        enabled: true,
        files,
        activePath,
        onJumpToFile: (next) => {
          jumped.push(next.path);
          setActivePath(next.path);
        },
        onToggleReviewed: () => {},
        onExit: () => {},
      });
      return (
        <div>
          {files.map((entry) => (
            <section
              key={entry.path}
              id={diffFileDomId(entry)}
              dangerouslySetInnerHTML={{ __html: cardMarkup(entry.path, [`${entry.path}-1`]) }}
            />
          ))}
        </div>
      );
    }

    const { cleanup } = await mount(<Spy />);
    await press("n");
    await press("j");

    expect(jumped).toEqual(["a.ts", "b.ts"]);
    await cleanup();
  });
});
