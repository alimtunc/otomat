export function commandTokens(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  const flush = (): void => {
    if (current.length === 0) return;
    tokens.push(current.toLowerCase());
    current = "";
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index] ?? "";
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote !== null) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      flush();
      continue;
    }
    if (character === ";" || character === "|" || character === "&") {
      flush();
      const pair = `${character}${command[index + 1] ?? ""}`;
      if (pair === "&&" || pair === "||") index += 1;
      tokens.push(pair === "&&" || pair === "||" ? pair : character);
      continue;
    }
    current += character;
  }
  if (escaped) current += "\\";
  flush();
  return tokens;
}
