const PROMPT_FIELD_PATTERNS = ["prompt", "system_prompt", "user_prompt"] as const;
const CREDENTIAL_FIELD_PATTERNS = [
  "api[_-]?key",
  "access[_-]?token",
  "github[_-]?token",
  "linear[_-]?api[_-]?key",
  "token",
  "authorization",
] as const;

function alternation(patterns: readonly string[]): string {
  return `(?:${patterns.join("|")})`;
}

export const PROMPT_FIELD_PATTERN = alternation(PROMPT_FIELD_PATTERNS);
export const CREDENTIAL_FIELD_PATTERN = alternation(CREDENTIAL_FIELD_PATTERNS);
export const SENSITIVE_FIELD_PATTERN = alternation([
  ...PROMPT_FIELD_PATTERNS,
  ...CREDENTIAL_FIELD_PATTERNS,
]);
