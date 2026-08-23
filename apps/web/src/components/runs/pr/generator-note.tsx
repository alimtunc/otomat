import type { PullRequestGeneratorAudit } from "@otomat/domain";

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
