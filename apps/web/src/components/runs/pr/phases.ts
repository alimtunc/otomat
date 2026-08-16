import type { PullRequestPublicationState } from "@otomat/domain";

export type PublicationPhaseState = "pending" | "active" | "done";

export interface PublicationPhase {
  key: "generate" | "push" | "create";
  label: string;
  state: PublicationPhaseState;
}

export interface PublicationProgressInput {
  generating: boolean;
  publishing: boolean;
  /** A proposal is already stored for this run. */
  generated: boolean;
  publicationStatus: PullRequestPublicationState | null;
}

function generateState(input: PublicationProgressInput): PublicationPhaseState {
  if (input.generating) return "active";
  return input.generated ? "done" : "pending";
}

function pushState(input: PublicationProgressInput): PublicationPhaseState {
  if (input.publicationStatus === "creating" || input.publicationStatus === "created")
    return "done";
  if (input.publicationStatus === "pushing" || input.publishing) return "active";
  return "pending";
}

function createState(input: PublicationProgressInput): PublicationPhaseState {
  if (input.publicationStatus === "created") return "done";
  return input.publicationStatus === "creating" ? "active" : "pending";
}

/** The three observable phases of one publication; empty while none of them has started. */
export function publicationPhases(input: PublicationProgressInput): PublicationPhase[] {
  const phases: PublicationPhase[] = [
    { key: "generate", label: "Writing metadata", state: generateState(input) },
    { key: "push", label: "Pushing branch", state: pushState(input) },
    { key: "create", label: "Creating pull request", state: createState(input) },
  ];
  return phases.every((phase) => phase.state === "pending") ? [] : phases;
}
