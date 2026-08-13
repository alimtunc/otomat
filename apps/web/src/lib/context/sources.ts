import type { ContextDraft } from "./draft";

/** One line of the launch preview: where a piece of the agent's context comes from. */
export interface ContextSource {
  id: string;
  label: string;
  detail: string;
}

export interface ContextSourceInput {
  draft: ContextDraft;
  /** Identifier of the issue Otomat attaches on its own; null for a run that has none. */
  issueLabel: string | null;
  /** Name of the resolved agent profile, or null when the launch names a runtime directly. */
  profileName: string | null;
  skillNames: readonly string[];
  /** Names of the plan nodes this one waits on; their evidence rides along. */
  dependencyNames: readonly string[];
}

/** Provenance stated before the launch, not a prompt to edit: the daemon composes the text from these itself. */
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
