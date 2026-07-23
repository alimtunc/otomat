import { SENSITIVE_FIELD_PATTERN } from "./sensitive-fields.js";

type SensitiveQuote = '"' | "'";
type StructuredCloser = "}" | "]";
export type AuthorizationContinuation = "none" | "scheme-or-value" | "value";

export type SensitiveValueState =
  | {
      kind: "quoted";
      quote: SensitiveQuote;
      precedingBackslashOdd: boolean;
    }
  | {
      kind: "structured";
      closers: StructuredCloser[];
      quote: SensitiveQuote | null;
      precedingBackslashOdd: boolean;
    }
  | { kind: "pending" }
  | { kind: "opaque" };

export interface SensitiveValueScan {
  state: SensitiveValueState | null;
  trailingText: string;
}

const SENSITIVE_KEY = `(?:"${SENSITIVE_FIELD_PATTERN}"|'${SENSITIVE_FIELD_PATTERN}'|\\b${SENSITIVE_FIELD_PATTERN}\\b)`;
const MAX_STRUCTURED_DEPTH = 32;
const QUOTED_OPENING = new RegExp(`(?:${SENSITIVE_KEY}\\s*[:=]\\s*|--prompt\\s+)(["'])`, "i");
const STRUCTURED_OPENING = new RegExp(`(?:${SENSITIVE_KEY}\\s*[:=]\\s*|--prompt\\s+)([\\[{])`, "i");
const PENDING_OPENING = new RegExp(`(?:${SENSITIVE_KEY}\\s*[:=]\\s*|--prompt\\s*)$`, "i");
const AUTHORIZATION_WITHOUT_SCHEME = /\bauthorization\s*:\s*$/i;
const AUTHORIZATION_WITHOUT_VALUE = /\bauthorization\s*:\s*(?:Bearer|Basic)\s*$/i;

interface Opening {
  index: number;
  length: number;
  state: SensitiveValueState;
}

function quotedState(quote: string): SensitiveValueState {
  if (quote !== '"' && quote !== "'") {
    throw new Error("A sensitive field matched without a supported quote.");
  }
  return { kind: "quoted", quote, precedingBackslashOdd: false };
}

function structuredState(opener: string): SensitiveValueState {
  if (opener !== "{" && opener !== "[") {
    throw new Error("A structured prompt matched without a supported delimiter.");
  }
  return {
    kind: "structured",
    closers: [opener === "{" ? "}" : "]"],
    quote: null,
    precedingBackslashOdd: false,
  };
}

function findNextOpening(value: string, cursor: number): Opening | null {
  const remaining = value.slice(cursor);
  const candidates = [
    matchOpening(QUOTED_OPENING.exec(remaining), cursor, (match) => quotedState(match[1])),
    matchOpening(STRUCTURED_OPENING.exec(remaining), cursor, (match) => structuredState(match[1])),
    matchOpening(PENDING_OPENING.exec(remaining), cursor, () => ({ kind: "pending" })),
  ].filter((opening): opening is Opening => opening !== null);
  return candidates.toSorted((left, right) => left.index - right.index)[0] ?? null;
}

function matchOpening(
  match: RegExpExecArray | null,
  cursor: number,
  state: (match: RegExpExecArray) => SensitiveValueState,
): Opening | null {
  if (match === null) return null;
  return {
    index: cursor + match.index,
    length: match[0].length,
    state: state(match),
  };
}

function scanQuoted(value: string, state: SensitiveValueState & { kind: "quoted" }): number {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === state.quote && !state.precedingBackslashOdd) return index;
    state.precedingBackslashOdd = character === "\\" ? !state.precedingBackslashOdd : false;
  }
  return -1;
}

function scanStructured(
  value: string,
  state: SensitiveValueState & { kind: "structured" },
): number {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (state.quote !== null) {
      if (character === state.quote && !state.precedingBackslashOdd) state.quote = null;
      state.precedingBackslashOdd = character === "\\" ? !state.precedingBackslashOdd : false;
      continue;
    }
    if (character === '"' || character === "'") {
      state.quote = character;
      state.precedingBackslashOdd = false;
    } else if (character === "{" || character === "[") {
      if (state.closers.length === MAX_STRUCTURED_DEPTH) return -2;
      state.closers.push(character === "{" ? "}" : "]");
    } else if (character === state.closers.at(-1)) {
      state.closers.pop();
      if (state.closers.length === 0) return index;
    }
  }
  return -1;
}

function scanClosing(value: string, state: SensitiveValueState): number {
  if (state.kind === "opaque") return -2;
  if (state.kind === "pending") return -1;
  return state.kind === "quoted" ? scanQuoted(value, state) : scanStructured(value, state);
}

function cloneState(state: SensitiveValueState): SensitiveValueState {
  return state.kind === "structured" ? { ...state, closers: [...state.closers] } : { ...state };
}

export function scanSensitiveValues(
  value: string,
  initialState: SensitiveValueState | null,
): SensitiveValueScan {
  let state = initialState === null ? null : cloneState(initialState);
  let cursor = 0;
  let trailingStart = 0;
  while (cursor <= value.length) {
    if (state === null) {
      const opening = findNextOpening(value, cursor);
      if (opening === null) return { state: null, trailingText: value.slice(trailingStart) };
      cursor = opening.index + opening.length;
      state = opening.state;
    }
    if (state.kind === "pending") {
      const valueStart = value.slice(cursor).search(/\S/);
      if (valueStart < 0) return { state, trailingText: "" };
      cursor += valueStart;
      const opener = value[cursor];
      if (opener === '"' || opener === "'") {
        state = quotedState(opener);
        cursor += 1;
      } else if (opener === "{" || opener === "[") {
        state = structuredState(opener);
        cursor += 1;
      } else if (/^(?:Bearer|Basic)\s*$/i.test(value.slice(cursor))) {
        return { state, trailingText: "" };
      } else {
        return { state: null, trailingText: "" };
      }
    }
    const closingIndex = scanClosing(value.slice(cursor), state);
    if (closingIndex === -2) return { state: { kind: "opaque" }, trailingText: "" };
    if (closingIndex < 0) return { state, trailingText: "" };
    cursor += closingIndex + 1;
    state = null;
    trailingStart = cursor;
  }
  return { state: null, trailingText: value.slice(trailingStart) };
}

export function advanceAuthorizationContinuation(
  value: string,
  current: AuthorizationContinuation,
): AuthorizationContinuation {
  if (AUTHORIZATION_WITHOUT_VALUE.test(value)) return "value";
  if (AUTHORIZATION_WITHOUT_SCHEME.test(value)) return "scheme-or-value";
  if (value.trim() === "") return current;
  if (current === "scheme-or-value" && /^(?:Bearer|Basic)\s*$/i.test(value)) return "value";
  return "none";
}
