/**
 * The prompt a delivery turn carries. A lone message is passed through verbatim
 * so a single contribution reads exactly like the user typed it; a batch keeps
 * every message intact and labels its send order, because the agent must be able
 * to tell what arrived while it was working and in which sequence.
 */
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
