/** One `<prefix><KIND>:<detail>` line as the host scripts report their outcome. */
export interface ScriptToken {
  kind: string;
  detail: string;
}

/**
 * The last `prefix`-tagged line of a script's stdout, split into its kind and its detail; null
 * when the script never reported one. Reading only the last token is what lets a login shell's
 * banner, and any earlier progress line, sit in front of the answer.
 */
export function lastToken(stdout: string, prefix: string): ScriptToken | null {
  const token = stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix))
    .at(-1)
    ?.slice(prefix.length);
  const separator = token?.indexOf(":") ?? -1;
  if (token === undefined || separator === -1) return null;
  return { kind: token.slice(0, separator), detail: token.slice(separator + 1) };
}
