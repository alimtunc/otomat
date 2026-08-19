import type { ProviderOptionKey } from "@otomat/domain";

/** Otomat's own name for each option. The CLI flag it maps to stays in the daemon's descriptor, where it is feature-detected. */
const KEY_LABELS = {
  permission_mode: "Permission mode",
  effort: "Effort",
  sandbox: "Sandbox",
  approval_policy: "Approval policy",
  reasoning_effort: "Reasoning effort",
} satisfies Record<ProviderOptionKey, string>;

export function providerOptionKeyLabel(key: ProviderOptionKey): string {
  return KEY_LABELS[key];
}

/** What Claude Code calls each mode in its own interface; `default` is the older spelling of `manual`. */
const PERMISSION_MODE_LABELS = new Map<string, string>([
  ["default", "Manual"],
  ["acceptEdits", "Edit automatically"],
  ["dontAsk", "Don't ask"],
]);

/** One option's vocabulary, which another option announcing the same value does not share. */
const KEY_VALUE_LABELS = new Map<ProviderOptionKey, Map<string, string>>([
  ["permission_mode", PERMISSION_MODE_LABELS],
]);

/** Values whose plain humanization would misread, whichever option announced them. */
const VALUE_LABELS = new Map<string, string>([["xhigh", "Extra high"]]);

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

/** `acceptEdits` and `workspace-write` both become a readable name; the identifier itself is never rewritten. */
export function providerOptionValueLabel(key: ProviderOptionKey, value: string): string {
  return KEY_VALUE_LABELS.get(key)?.get(value) ?? VALUE_LABELS.get(value) ?? sentenceCase(value);
}
