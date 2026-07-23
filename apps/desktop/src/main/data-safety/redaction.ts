import { lineEnding, splitLogText, withoutLineEnding } from "./log-lines.js";
import { CREDENTIAL_FIELD_PATTERN, PROMPT_FIELD_PATTERN } from "./sensitive-fields.js";
import {
  advanceAuthorizationContinuation,
  type AuthorizationContinuation,
  scanSensitiveValues,
  type SensitiveValueState,
} from "./sensitive-value-scanner.js";

const SECRET_TOKEN = /\b(?:lin_api_|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|sk-)[A-Za-z0-9_-]{4,}\b/gi;
const AUTHORIZATION = /(\bauthorization\s*:\s*)(?:Bearer|Basic)(?:\s+\S+)?/gi;
const JSON_SENSITIVE_ASSIGNMENT = new RegExp(
  `((?:"${CREDENTIAL_FIELD_PATTERN}"|'${CREDENTIAL_FIELD_PATTERN}')\\s*:\\s*)("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`,
  "gi",
);
const SENSITIVE_ASSIGNMENT = new RegExp(
  `(\\b${CREDENTIAL_FIELD_PATTERN}\\b\\s*[:=]\\s*)("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^\\s,}]+)`,
  "gi",
);
const STRUCTURED_CREDENTIAL_TO_LINE_END = new RegExp(
  `((?:"${CREDENTIAL_FIELD_PATTERN}"|'${CREDENTIAL_FIELD_PATTERN}'|\\b${CREDENTIAL_FIELD_PATTERN}\\b)\\s*[:=]\\s*)[\\[{][^\\r\\n]*`,
  "gi",
);
const PROMPT_TO_LINE_END = new RegExp(
  `((?:"${PROMPT_FIELD_PATTERN}"|'${PROMPT_FIELD_PATTERN}'|\\b${PROMPT_FIELD_PATTERN}\\b)\\s*[:=]\\s*|--prompt\\s+)[^\\r\\n]*`,
  "gi",
);

function redactLine(value: string): string {
  return value
    .replace(AUTHORIZATION, "$1[REDACTED]")
    .replace(JSON_SENSITIVE_ASSIGNMENT, '$1"[REDACTED]"')
    .replace(STRUCTURED_CREDENTIAL_TO_LINE_END, "$1[REDACTED]")
    .replace(SENSITIVE_ASSIGNMENT, "$1[REDACTED]")
    .replace(PROMPT_TO_LINE_END, "$1[REDACTED]")
    .replace(SECRET_TOKEN, "[REDACTED]");
}

export function redactLogText(value: string): string {
  let sensitiveState: SensitiveValueState | null = null;
  let authorizationContinuation: AuthorizationContinuation = "none";
  return splitLogText(value, true)
    .lines.map((line) => {
      const continuingSensitiveValue = sensitiveState !== null;
      const suppressAuthorizationContinuation = authorizationContinuation !== "none";
      const scan = scanSensitiveValues(withoutLineEnding(line), sensitiveState);
      sensitiveState = scan.state;
      authorizationContinuation = advanceAuthorizationContinuation(
        scan.trailingText,
        authorizationContinuation,
      );
      if (suppressAuthorizationContinuation || (continuingSensitiveValue && scan.state !== null)) {
        return lineEnding(line);
      }
      if (!continuingSensitiveValue && scan.state !== null) {
        return `[REDACTED MULTILINE VALUE]${lineEnding(line)}`;
      }
      if (continuingSensitiveValue) {
        return `${redactLine(scan.trailingText)}${lineEnding(line)}`;
      }
      return redactLine(line);
    })
    .join("");
}
