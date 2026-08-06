/** One `<prefix><KIND>:<detail>` line as the host scripts report their outcome. */
export interface ScriptToken {
  kind: string;
  detail: string;
}

/** Only the last token counts, so a login shell's banner may sit in front of the answer. */
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
