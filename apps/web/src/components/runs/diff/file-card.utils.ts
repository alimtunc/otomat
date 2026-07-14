import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";
import type { KeyboardEvent } from "react";

/** Shapes the per-line comments into @git-diff-view's `extendData` contract (new side only). */
export function extendDataFor(commentsByLine: Map<number, ReviewCommentContract[]>) {
  const newFile: Record<string, { data: ReviewCommentContract[] }> = {};
  for (const [line, comments] of commentsByLine) {
    newFile[String(line)] = { data: comments };
  }
  return { newFile };
}

/** A note to render in place of the diff body when a file has no textual hunk, else null. */
export function unrenderableNote(file: DiffFileContract): string | null {
  if (file.binary) return "Binary file — no textual diff.";
  if (file.patch === "") return "Git emitted no hunk for this file.";
  return null;
}

export function diffCommentButtonLabel(filePath: string, line: number): string {
  return `Add comment on ${filePath} line ${line}`;
}

export function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

export function handleCommentButtonKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.matches(".diff-add-widget")) return;
  if (!isActivationKey(event.key)) return;
  target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  event.preventDefault();
  event.stopPropagation();
}

export function configureDiffCommentButtons(root: ParentNode, filePath: string): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>(".diff-add-widget");
  for (const button of buttons) {
    const wrapper = button.closest<HTMLElement>("[data-add-widget]");
    const side = wrapper?.dataset["addWidget"];
    if (side !== "new") continue;
    const lineText = button.closest("tr")?.querySelector("[data-line-new-num]")?.textContent;
    if (lineText === null || lineText === undefined) continue;
    const line = Number(lineText);
    if (!Number.isInteger(line)) continue;
    button.type = "button";
    button.setAttribute("aria-label", diffCommentButtonLabel(filePath, line));
  }
}
