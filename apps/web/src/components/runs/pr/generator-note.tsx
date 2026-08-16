import type { PullRequestGeneratorAudit } from "@otomat/domain";

/** What actually wrote the text on screen; a generation that named no model says so rather than implying one. */
export function PullRequestGeneratorNote({
  generator,
}: {
  generator: PullRequestGeneratorAudit | null;
}) {
  if (generator === null) return null;
  const segments = [
    generator.runtime,
    generator.model ?? "provider default model",
    generator.effort,
  ]
    .filter((segment) => segment !== null)
    .join(" · ");
  return <p className="text-xs text-text-tertiary">Written by {segments}</p>;
}
