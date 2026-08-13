export type NamePromptKind = "saveAs" | "rename" | "duplicate";

export interface NamePrompt {
  title: string;
  submitLabel: string;
  name: string;
}

export function namePrompt(kind: NamePromptKind, activeName: string): NamePrompt {
  switch (kind) {
    case "rename":
      return { title: "Rename view", submitLabel: "Rename", name: activeName };
    case "duplicate":
      return { title: "Duplicate view", submitLabel: "Duplicate", name: `${activeName} copy` };
    case "saveAs":
      return { title: "Save as view", submitLabel: "Save view", name: "" };
  }
}
