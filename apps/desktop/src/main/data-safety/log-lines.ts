export interface SplitLogText {
  lines: string[];
  remainder: string;
}

export function splitLogText(value: string, endOfInput: boolean): SplitLogText {
  const lines: string[] = [];
  let lineStart = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\r" && character !== "\n") continue;
    if (character === "\r" && index === value.length - 1 && !endOfInput) break;
    if (character === "\r" && value[index + 1] === "\n") index += 1;
    lines.push(value.slice(lineStart, index + 1));
    lineStart = index + 1;
  }
  if (endOfInput && lineStart < value.length) {
    lines.push(value.slice(lineStart));
    lineStart = value.length;
  }
  return { lines, remainder: value.slice(lineStart) };
}

export function withoutLineEnding(value: string): string {
  if (value.endsWith("\r\n")) return value.slice(0, -2);
  if (value.endsWith("\n") || value.endsWith("\r")) return value.slice(0, -1);
  return value;
}

export function lineEnding(value: string): string {
  if (value.endsWith("\r\n")) return "\r\n";
  if (value.endsWith("\n")) return "\n";
  return value.endsWith("\r") ? "\r" : "";
}
