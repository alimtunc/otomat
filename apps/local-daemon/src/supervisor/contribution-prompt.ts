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
