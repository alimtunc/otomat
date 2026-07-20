import type { EventEnvelope } from "@otomat/domain";
import { asNumber, asString } from "@web/lib/coerce";

export interface TestEvidence {
  id: string;
  command: string;
  outcome: "running" | "completed" | "passed" | "failed";
  exitCode: number | null;
  output: string | null;
}

export function testOutcomeClass(outcome: TestEvidence["outcome"]): string {
  if (outcome === "failed") return "text-danger";
  if (outcome === "passed") return "text-success";
  return "text-text-secondary";
}

const PACKAGE_MANAGERS = new Set(["pnpm", "npm", "yarn", "bun"]);
const TEST_RUNNERS = new Set(["vitest", "jest", "pytest", "mocha"]);
const COMMAND_TOOLS = new Set(["bash", "command_execution"]);
const OPTIONS_WITH_VALUE = new Set(["--config", "--dir", "--filter", "--workspace", "-c", "-f"]);
const RUNNER_OPTIONS_WITH_VALUE = new Set(["--call", "--package", "-c", "-p"]);
const NON_EXECUTION_FLAGS = new Set([
  "--collect-only",
  "--co",
  "--fixtures",
  "--help",
  "--list",
  "--listtests",
  "--markers",
  "--no-run",
  "--showconfig",
  "--showseed",
  "--trace-config",
  "--version",
  "-list",
  "-h",
]);
const TEST_SCRIPT_PATTERN = /^(?:test|check|lint|typecheck)(?::[a-z0-9_-]+)*$/i;

function commandTokens(command: string): string[] {
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

function executableName(token: string): string {
  return token.split("/").at(-1) ?? token;
}

function runnerIndex(tokens: readonly string[], start: number): number {
  let index = start;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "--") {
      index += 1;
      continue;
    }
    if (RUNNER_OPTIONS_WITH_VALUE.has(token)) {
      index += 2;
      continue;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    return index;
  }
  return index;
}

function invokesTestRunner(tokens: readonly string[], start: number): boolean {
  const index = runnerIndex(tokens, start);
  const executable = executableName(tokens[index] ?? "");
  const runnerArgs = tokens.slice(index + 1);
  if (runnerArgs.some((token) => NON_EXECUTION_FLAGS.has(token))) return false;
  if (TEST_RUNNERS.has(executable)) {
    if (executable === "vitest" && runnerArgs[0] === "list") return false;
    return executable === "pytest" || !runnerArgs.includes("-v");
  }
  if (executable === "playwright") return runnerArgs[0] === "test";
  if (executable === "cypress") return runnerArgs[0] === "run";
  return (executable === "cargo" || executable === "go") && runnerArgs[0] === "test";
}

function testScriptRuns(tokens: readonly string[], scriptIndex: number): boolean {
  if (!TEST_SCRIPT_PATTERN.test(tokens[scriptIndex] ?? "")) return false;
  return !tokens.slice(scriptIndex + 1).some((token) => NON_EXECUTION_FLAGS.has(token));
}

function packageManagerRunsTests(tokens: readonly string[], managerIndex: number): boolean {
  let index = managerIndex + 1;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token === "run") return testScriptRuns(tokens, index + 1);
    if (token === "exec" || token === "dlx") return invokesTestRunner(tokens, index + 1);
    if (token === "workspace") {
      index += 2;
      continue;
    }
    if (OPTIONS_WITH_VALUE.has(token)) {
      index += 2;
      continue;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    return testScriptRuns(tokens, index);
  }
  return false;
}

function executableIndex(tokens: readonly string[]): number {
  let index = 0;
  while (index < tokens.length) {
    const token = executableName(tokens[index] ?? "");
    if (/^[a-z_][a-z0-9_]*=/.test(token)) {
      index += 1;
      continue;
    }
    if (token === "env" || token === "sudo" || token === "command" || token === "nohup") {
      index += 1;
      while ((tokens[index] ?? "").startsWith("-")) index += 1;
      continue;
    }
    return index;
  }
  return index;
}

function segmentRunsTests(tokens: readonly string[]): boolean {
  const index = executableIndex(tokens);
  const executable = executableName(tokens[index] ?? "");
  if (
    (executable === "sh" || executable === "bash" || executable === "zsh") &&
    (tokens[index + 1] === "-c" || tokens[index + 1] === "-lc")
  ) {
    return isExplicitTestCommand(tokens[index + 2] ?? "");
  }
  if (PACKAGE_MANAGERS.has(executable)) return packageManagerRunsTests(tokens, index);
  if (executable === "npx") return invokesTestRunner(tokens, index + 1);
  if (executable === "make" || executable === "just") {
    return testScriptRuns(tokens, index + 1);
  }
  return invokesTestRunner(tokens, index);
}

function isExplicitTestCommand(command: string): boolean {
  const segments: string[][] = [[]];
  for (const token of commandTokens(command)) {
    if (token === "&&" || token === "||" || token === ";" || token === "|" || token === "&") {
      segments.push([]);
    } else {
      segments.at(-1)?.push(token);
    }
  }
  return segments.some(segmentRunsTests);
}

function commandFromArgs(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("command" in value)) return null;
  return asString(value.command);
}

function exitCodeFromResult(value: unknown): number | null {
  if (typeof value !== "object" || value === null || !("exit_code" in value)) return null;
  return asNumber(value.exit_code);
}

function outputFromResult(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const lines = value.flatMap((entry) => outputFromResult(entry) ?? []);
    return lines.length > 0 ? lines.join("\n") : null;
  }
  if (typeof value !== "object" || value === null) return null;
  if ("output" in value) return asString(value.output);
  if ("text" in value) return asString(value.text);
  return null;
}

function testOutcome(
  resultEvent: EventEnvelope | undefined,
  exitCode: number | null,
): TestEvidence["outcome"] {
  if (!resultEvent) return "running";
  if (resultEvent.payload["is_error"] === true || (exitCode !== null && exitCode !== 0)) {
    return "failed";
  }
  return exitCode === 0 ? "passed" : "completed";
}

export function collectTestEvidence(events: readonly EventEnvelope[]): TestEvidence[] {
  const resultEventsByToolUseId = new Map<string, EventEnvelope>();
  for (const event of events) {
    const toolUseId = asString(event.payload["tool_use_id"]);
    if (event.type === "runtime.tool_call" && event.payload["phase"] === "result" && toolUseId) {
      resultEventsByToolUseId.set(toolUseId, event);
    }
  }
  return events.flatMap((event) => {
    if (event.type !== "runtime.tool_call" || event.payload["phase"] !== "call") return [];
    const tool = asString(event.payload["tool"])?.toLowerCase();
    if (!tool || !COMMAND_TOOLS.has(tool)) return [];
    const command = commandFromArgs(event.payload["args"]);
    if (!command || !isExplicitTestCommand(command)) return [];
    const toolUseId = asString(event.payload["tool_use_id"]);
    const resultEvent = toolUseId ? resultEventsByToolUseId.get(toolUseId) : undefined;
    const exitCode = exitCodeFromResult(resultEvent?.payload["result"]);
    return [
      {
        id: event.id,
        command,
        outcome: testOutcome(resultEvent, exitCode),
        exitCode,
        output: outputFromResult(resultEvent?.payload["result"]),
      },
    ];
  });
}
