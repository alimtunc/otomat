const PACKAGE_MANAGERS = new Set(["pnpm", "npm", "yarn", "bun"]);
const TEST_RUNNERS = new Set(["vitest", "jest", "pytest", "mocha"]);
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
const TEST_SCRIPT_PATTERN = /^test(?::[a-z0-9_-]+)*$/i;

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

/** True only when the full command is an explicit test execution, never a mention or compound shell line. */
export function isExplicitTestCommand(command: string): boolean {
  const tokens = commandTokens(command);
  if (tokens.some((token) => ["&&", "||", ";", "|", "&"].includes(token))) return false;
  return segmentRunsTests(tokens);
}
