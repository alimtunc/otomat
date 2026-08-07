import { providerOptionValueSchema } from "@otomat/domain";

/**
 * The three shapes a CLI announces a flag's values in, alternated into one
 * pattern so an entry is scanned once instead of once per shape: clap's
 * `[possible values: read-only, workspace-write]`, commander's explicit
 * `(choices: "text", "stream-json")`, and a bare `(low, medium, high)`
 * enumeration inside a description. The bare form stays last-resort: it only
 * wins when the entry announces neither of the two explicit ones.
 */
const ANNOUNCED_VALUES =
  /\[possible values:\s*([^\]]+)\]|\(choices:\s*([^)]+)\)|\(([a-z0-9][\w.-]*(?:,\s*[a-z0-9][\w.-]*)+)\)/g;
const QUOTED = /"([^"]+)"/g;

/**
 * One `--help` entry per flag, with the CLI's wrapped continuation lines folded
 * back in. An unindented line starts a new section and ends the current entry;
 * blank lines do not, because clap prints `[possible values: …]` in its own
 * paragraph below the description.
 */
function helpEntries(help: string): string[] {
  const entries: string[] = [];
  let current: string[] = [];
  for (const line of help.split("\n")) {
    if (line.trim().length === 0) continue;
    const startsFlag = /^\s+-/.test(line);
    if (startsFlag || !/^\s/.test(line)) {
      if (current.length > 0) entries.push(current.join(" "));
      current = startsFlag ? [line.trim()] : [];
      continue;
    }
    if (current.length > 0) current.push(line.trim());
  }
  if (current.length > 0) entries.push(current.join(" "));
  return entries;
}

/** `split` already walks the list, so trimming and dropping empties happen in that same pass. */
function splitList(raw: string): string[] {
  const items: string[] = [];
  for (const part of raw.split(",")) {
    const item = part.trim();
    if (item.length > 0) items.push(item);
  }
  return items;
}

function announcedValues(entry: string): string[] {
  let bare: string | undefined;
  for (const match of entry.matchAll(ANNOUNCED_VALUES)) {
    const possible = match.at(1);
    if (possible !== undefined) return splitList(possible);
    const quoted = match.at(2);
    if (quoted !== undefined) {
      return [...quoted.matchAll(QUOTED)].map((choice) => choice[1] ?? "");
    }
    bare ??= match.at(3);
  }
  return bare === undefined ? [] : splitList(bare);
}

/**
 * The values an installed CLI's own `--help` announces for one flag, in the
 * order it printed them. `null` means this version does not document the flag
 * at all; an empty array means it does but enumerates no values, and Otomat
 * offers none rather than inventing a set. Values that could not survive as a
 * CLI argument are dropped.
 */
export function helpFlagValues(help: string, flag: string): string[] | null {
  // Compiled once for the whole page rather than once per entry it walks past.
  const declaresFlag = new RegExp(`(^|[\\s,])${flag}([\\s,=]|$)`);
  const entry = helpEntries(help).find((candidate) => declaresFlag.test(candidate));
  if (entry === undefined) return null;
  const values = announcedValues(entry).filter(
    (value) => providerOptionValueSchema.safeParse(value).success,
  );
  return [...new Set(values)];
}
