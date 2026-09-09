import { dialog } from "electron";

import type { LocalWorkItem } from "./work-items.js";
import { localWorkLines } from "./work-lines.js";

export type CloseChoice = "background" | "quit" | "cancel";

const CLOSE_CHOICES = ["background", "quit", "cancel"] as const satisfies readonly CloseChoice[];

export async function askCloseChoice(
  items: readonly LocalWorkItem[] | null,
  iconPath: string,
): Promise<CloseChoice> {
  const { response } = await dialog.showMessageBox({
    type: "question",
    icon: iconPath,
    message: "Keep Otomat running in the background?",
    detail: `${localWorkLines(items).join(" · ")}\n\nOtomat can keep the local runs going without a window; quitting stops them.`,
    buttons: ["Keep Running in Background", "Stop Runs and Quit", "Cancel"],
    defaultId: 0,
    cancelId: 2,
  });
  return CLOSE_CHOICES[response] ?? "cancel";
}
