import type { IssueReference, IssueReferenceSurface } from "@otomat/domain";

const ISSUE_REFERENCE_SURFACE_LABEL = {
  title: "title",
  body: "description",
  branch: "branch name",
} satisfies Record<IssueReferenceSurface, string>;

export function issueReferenceProof(reference: IssueReference): string {
  const surface = ISSUE_REFERENCE_SURFACE_LABEL[reference.surface];
  return `Names ${reference.identifier} in its ${surface}: “${reference.excerpt}”`;
}
