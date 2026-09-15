import { spawnSync } from "node:child_process";

export const GREEN = "78";
export const BLUE = "69";
export const YELLOW = "220";
const RED = "196";
const BOX = ["--border-foreground", GREEN, "--padding", "0 2"];

export const paint = (color, text) => `\x1b[38;5;${color}m${text}\x1b[0m`;
export const bold = (text) => `\x1b[1m${text}\x1b[0m`;
export const dim = (text) => `\x1b[2m${text}\x1b[0m`;
export const success = (text) => console.log(`  ${paint(GREEN, "✓")} ${text}`);
export const failure = (text) => console.log(`  ${paint(RED, "✗")} ${text}`);
export const muted = (text) => console.log(`  ${dim(text)}`);
export const row = (name, value) => console.log(`  ${bold(name.padEnd(12))}${value}`);

export const commitLine = (sha, subject) =>
  console.log(`    ${paint(BLUE, sha)} ${dim("—")} ${subject}`);

const gum = (args, stdio = ["inherit", "pipe", "inherit"], cwd = undefined) =>
  spawnSync("gum", args, { cwd, encoding: "utf8", stdio });

export const header = (title) => {
  console.log();
  gum(["style", "--bold", "--foreground", GREEN, "--border", "double", ...BOX, title], "inherit");
  console.log();
};

export const box = (...text) => {
  console.log();
  gum(["style", "--border", "rounded", ...BOX, ...text], "inherit");
  console.log();
};

const abort = () => {
  muted("Aborted.");
  process.exit(130);
};

export const choose = (headerText, options) => {
  const picked = gum(["choose", "--header", headerText, "--cursor.foreground", GREEN, ...options]);
  if (picked.status !== 0) abort();
  return picked.stdout.trim();
};

export const input = (headerText, placeholder) => {
  const typed = gum(["input", "--header", headerText, "--placeholder", placeholder]);
  if (typed.status !== 0) abort();
  return typed.stdout.trim();
};

export const confirm = (question, affirmative) => {
  const flags = [
    "--affirmative",
    affirmative,
    "--negative",
    "Cancel",
    "--selected.background",
    GREEN,
  ];
  const answer = gum(["confirm", ...flags, question], "inherit");
  if (answer.status === 1) return false;
  if (answer.status !== 0) abort();
  return true;
};

export const spin = (title, cwd, command, args) => {
  const flags = ["--spinner", "dot", "--title", title, "--show-error", "--"];
  return gum(["spin", ...flags, command, ...args], "inherit", cwd).status === 0;
};
