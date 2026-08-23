import type { ContextDraft } from "./draft";

export interface ContextSource {
  id: string;
  label: string;
  detail: string;
}

export interface ContextSourceInput {
  draft: ContextDraft;
  issueLabel: string | null;
  profileName: string | null;
  skillNames: readonly string[];
  dependencyNames: readonly string[];
}

export function contextSources(input: ContextSourceInput): ContextSource[] {
  const issues = input.draft.references.filter((reference) => reference.kind === "issue");
  const files = input.draft.references.filter((reference) => reference.kind === "file");
  const note = input.draft.note.trim();
  return [
    ...(input.issueLabel === null
      ? []
      : [
          {
            id: "issue",
            label: "Issue snapshot attached",
            detail: `${input.issueLabel}, frozen from this daemon's own records`,
          },
        ]),
    ...(issues.length === 0
      ? []
      : [
          {
            id: "issues",
            label: `${issues.length} referenced issue${issues.length === 1 ? "" : "s"}`,
            detail: "attached as snapshots, not as copied text",
          },
        ]),
    ...(files.length === 0
      ? []
      : [
          {
            id: "files",
            label: `${files.length} repository file${files.length === 1 ? "" : "s"}`,
            detail: files.map((file) => file.path).join(", "),
          },
        ]),
    {
      id: "profile",
      label:
        input.profileName === null ? "No profile guidance" : `Guidance from ${input.profileName}`,
      detail:
        input.skillNames.length === 0
          ? "no skill enabled"
          : `skills: ${input.skillNames.join(", ")}`,
    },
    ...(input.dependencyNames.length === 0
      ? []
      : [
          {
            id: "predecessors",
            label: "Previous-step evidence and diff",
            detail: `from ${input.dependencyNames.join(", ")}`,
          },
        ]),
    ...(note === ""
      ? []
      : [{ id: "note", label: "Your step instructions", detail: note.split("\n")[0] ?? "" }]),
  ];
}
