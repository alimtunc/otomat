/** A lone message goes through verbatim; a batch is labelled so the agent can tell what arrived, and in which order. */
export function buildContributionPrompt(bodies: readonly string[]): string {
  const [only] = bodies;
  if (only === undefined) throw new Error("a contribution batch needs at least one message");
  if (bodies.length === 1) return only;
  return [
    `The user sent ${bodies.length} messages while you were working. Address them in this order.`,
    "",
    ...bodies.flatMap((body, index) => [`--- Message ${index + 1} ---`, body, ""]),
  ]
    .join("\n")
    .trimEnd();
}

function carriedHeader(count: number): string {
  const what = count === 1 ? "a message" : `${count} messages`;
  const them = count === 1 ? "it" : "them";
  return `The user sent ${what} before this turn started. Take ${them} into account.`;
}

/** Messages that arrived before the turn could start ride along with its prompt instead of waiting for a further turn. */
export function withCarriedContributions(base: string, bodies: readonly string[]): string {
  if (bodies.length === 0) return base;
  if (base.length === 0) return buildContributionPrompt(bodies);
  return [base, "", carriedHeader(bodies.length), "", buildContributionPrompt(bodies)].join("\n");
}
