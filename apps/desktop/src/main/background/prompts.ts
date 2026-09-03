import { dialog } from "electron";

import { localWorkLines } from "./work-lines.js";
import type { LocalWorkSummary } from "./work-summary.js";

export type CloseChoice = "background" | "quit" | "cancel";

const CLOSE_CHOICES = ["background", "quit", "cancel"] as const satisfies readonly CloseChoice[];

export async function askCloseChoice(summary: LocalWorkSummary | null): Promise<CloseChoice> {
  const { response } = await dialog.showMessageBox({
    type: "question",
    message: "Keep Otomat running in the background?",
    detail: `${localWorkLines(summary).join(" · ")}\n\nClosing the window can leave the local runs going; quitting stops them.`,
    buttons: ["Keep Running in Background", "Stop Runs and Quit", "Cancel"],
    defaultId: 0,
    cancelId: 2,
  });
  return CLOSE_CHOICES[response] ?? "cancel";
}

export async function confirmQuit(summary: LocalWorkSummary | null): Promise<boolean> {
  const { response } = await dialog.showMessageBox({
    type: "warning",
    message: "Quitting stops the local runs in progress.",
    detail: `${localWorkLines(summary).join(" · ")}\n\nInterrupted runs keep their branch and worktree.`,
    buttons: ["Quit Otomat", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  });
  return response === 0;
}
