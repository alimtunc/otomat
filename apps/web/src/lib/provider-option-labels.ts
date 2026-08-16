import type { ProviderOptionKey } from "@otomat/domain";

/** Otomat's own name for each option. The CLI flag it maps to stays in the daemon's descriptor, where it is feature-detected. */
const KEY_LABELS: Record<ProviderOptionKey, string> = {
  permission_mode: "Permission mode",
  effort: "Effort",
  sandbox: "Sandbox",
  approval_policy: "Approval policy",
  reasoning_effort: "Reasoning effort",
};

export function providerOptionKeyLabel(key: ProviderOptionKey): string {
  return KEY_LABELS[key];
}

/** Values whose plain humanization would misread. Presentation only: it never adds, hides or reinterprets a value the CLI announced. */
const VALUE_LABELS: Record<string, string> = {
  dontAsk: "Don't ask",
  xhigh: "Extra high",
};

/** Word boundaries in the identifiers CLIs announce: camelCase humps, hyphens and underscores. */
const IDENTIFIER_WORDS = /[A-Z]?[a-z0-9]+|[A-Z]+/g;

/** One walk over the value: each word is cased as it is found, rather than chaining replaces over the whole string. */
function sentenceCase(value: string): string {
  let sentence = "";
  for (const [word] of value.matchAll(IDENTIFIER_WORDS)) {
    const lower = word.toLowerCase();
    sentence += sentence === "" ? lower.charAt(0).toUpperCase() + lower.slice(1) : ` ${lower}`;
  }
  return sentence === "" ? value : sentence;
}

/** `acceptEdits` and `workspace-write` both become sentence case; the identifier itself is never rewritten. */
export function providerOptionValueLabel(value: string): string {
  return VALUE_LABELS[value] ?? sentenceCase(value);
}

/** The identifier a humanized label hides, so the value the CLI receives stays readable; nothing when the label already spells it. */
export function providerOptionValueHint(value: string): string | undefined {
  return providerOptionValueLabel(value).toLowerCase() === value.toLowerCase() ? undefined : value;
}
