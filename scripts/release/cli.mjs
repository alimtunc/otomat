#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { missingToolProblems, preflightProblems, tagProblems } from "./preflight.mjs";
import {
  BLUE,
  GREEN,
  YELLOW,
  bold,
  box,
  choose,
  commitLine,
  confirm,
  dim,
  failure,
  header,
  input,
  muted,
  paint,
  row,
  spin,
  success,
} from "./ui.mjs";
import { formatVersion, nextVersionProblem, parseVersion, versionChoices } from "./version.mjs";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const VERSION_FILE_RELATIVE = "apps/desktop/package.json";
const VERSION_FILE = join(ROOT, VERSION_FILE_RELATIVE);
const WORKFLOW = "release-macos.yml";
const TOOLS = ["git", "gh", "gum"];
const CUSTOM_CHOICE = "Enter a version…";
const COMMITS_SHOWN = 20;
const RUN_LOOKUPS = 15;

const run = (command, args, stdio = ["ignore", "pipe", "pipe"]) =>
  spawnSync(command, args, { cwd: ROOT, encoding: "utf8", stdio });

const succeeds = (command, args) => run(command, args).status === 0;

const output = (command, args) => {
  const result = run(command, args);
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}${result.stderr ?? result.error?.message ?? ""}`;
    throw new Error(`${command} ${args.join(" ")} failed:\n${detail}`);
  }
  return result.stdout.trim();
};

const lines = (text) => (text === "" ? [] : text.split("\n"));

const refuse = (problems) => {
  for (const problem of problems) {
    failure(problem.message);
    muted(problem.hint);
  }
  process.exit(1);
};

const gatherFacts = () => {
  const [ahead, behind] = output("git", [
    "rev-list",
    "--left-right",
    "--count",
    "HEAD...origin/main",
  ])
    .split("\t")
    .map(Number);
  return {
    ghAuthenticated: succeeds("gh", ["auth", "status"]),
    branch: output("git", ["branch", "--show-current"]),
    dirtyEntries: lines(output("git", ["status", "--porcelain", "--untracked-files=all"])),
    ahead,
    behind,
  };
};

const chooseVersion = (current, requested) => {
  if (requested !== undefined) return requested;
  const choices = versionChoices(current).map((choice) => `${choice.version} — ${choice.label}`);
  const picked = choose(`Next version (current ${formatVersion(current)})`, [
    ...choices,
    CUSTOM_CHOICE,
  ]);
  if (picked === CUSTOM_CHOICE) return input("Version", "1.2.3 or 1.2.3-alpha.1");
  return picked.split(" — ")[0];
};

const gatherTagFacts = (tag) => ({
  localTags: lines(output("git", ["tag", "--list"])),
  remoteTags: lines(output("git", ["ls-remote", "--tags", "origin"])).map(
    (line) => line.split("refs/tags/")[1],
  ),
  releaseExists: succeeds("gh", ["release", "view", tag]),
});

const describePlan = (target) => {
  const previous = run("git", ["describe", "--tags", "--abbrev=0", "--match", "v*", "HEAD"]);
  const previousTag = previous.status === 0 ? previous.stdout.trim() : null;
  const range = previousTag === null ? "HEAD" : `${previousTag}..HEAD`;
  return {
    ...target,
    startSubject: output("git", ["log", "-1", "--format=%s"]),
    previousTag,
    commits: lines(output("git", ["log", "--format=%h%x09%s", range])).map((line) => {
      const tab = line.indexOf("\t");
      return { sha: line.slice(0, tab), subject: line.slice(tab + 1) };
    }),
  };
};

const showPlan = (plan) => {
  header("Release plan");
  row("Version", `${formatVersion(plan.current)} → ${paint(GREEN, plan.next)}`);
  row("From", `main @ ${paint(BLUE, plan.start)} ${dim(plan.startSubject)}`);
  row("Tag", paint(GREEN, plan.tag));
  row("Workflow", `${WORKFLOW} ${dim("check · build · sign · notarize · smoke · publish")}`);
  row(
    "Publishes",
    plan.next.includes("-")
      ? `${paint(YELLOW, "GitHub prerelease")} ${dim("(the version carries a suffix)")}`
      : `${paint(GREEN, "GitHub release")} ${dim("(stable update feed)")}`,
  );
  console.log();
  const since = plan.previousTag ?? "the first commit (no v* tag yet)";
  console.log(
    `  ${paint(BLUE, bold(`Commits since ${since}`))} ${dim(String(plan.commits.length))}`,
  );
  for (const { sha, subject } of plan.commits.slice(0, COMMITS_SHOWN)) commitLine(sha, subject);
  if (plan.commits.length > COMMITS_SHOWN) muted(`  … ${plan.commits.length - COMMITS_SHOWN} more`);
  console.log();
};

const writeVersion = (next) => {
  const text = readFileSync(VERSION_FILE, "utf8");
  const updated = text.replace(/^(\s*"version":\s*")[^"]*(")/m, `$1${next}$2`);
  if (updated === text) {
    throw new Error(`${VERSION_FILE_RELATIVE} carries no "version" field to bump.`);
  }
  writeFileSync(VERSION_FILE, updated);
};

const runVisible = (title, command, args) => {
  console.log();
  muted(`$ ${command} ${args.join(" ")}`);
  const result = run(command, args, "inherit");
  if (result.status === 0) return;
  throw new Error(
    `${title} failed (${command} exited with ${result.status ?? String(result.signal)}).`,
  );
};

const rollback = (plan, undo) => {
  const leftovers = undo.toReversed().flatMap((step) => {
    try {
      step();
      return [];
    } catch (error) {
      return [error.message];
    }
  });
  if (leftovers.length === 0) {
    muted(`Rolled back: main is at ${plan.start}; no commit and no tag reached origin.`);
    return;
  }
  for (const message of leftovers) failure(`Rollback step failed: ${message}`);
  muted(`Inspect the checkout: it should be main @ ${plan.start} with no ${plan.tag} tag.`);
};

const settleFailedPush = (plan, undo) => {
  const probe = run("git", ["ls-remote", "--tags", "origin", plan.tag]);
  if (probe.status !== 0) {
    muted(
      `origin is unreachable, so whether ${plan.tag} landed is unknown; the checkout is kept as is.`,
    );
    muted(`Check with: git ls-remote --tags origin ${plan.tag}`);
  } else if (probe.stdout.trim() !== "") {
    muted(`${plan.tag} did reach origin, so ${WORKFLOW} is running; the checkout is kept as is.`);
    muted("Compare with: git status && git log origin/main -1");
  } else {
    rollback(plan, undo);
  }
};

const execute = (plan) => {
  header("Cutting the release");
  const undo = [];
  let pushed = false;
  try {
    writeVersion(plan.next);
    undo.push(() => output("git", ["checkout", "HEAD", "--", VERSION_FILE]));
    success(`${VERSION_FILE_RELATIVE} → ${plan.next}`);
    runVisible("pnpm check", "pnpm", ["check"]);
    output("git", ["add", VERSION_FILE]);
    output("git", ["commit", "--quiet", "--message", `chore(release): cut ${plan.tag}`]);
    undo.push(() => output("git", ["reset", "--quiet", "--hard", plan.start]));
    success(`Committed chore(release): cut ${plan.tag}`);
    output("git", ["tag", "--annotate", "--message", `Otomat ${plan.tag}`, plan.tag]);
    undo.push(() => output("git", ["tag", "--delete", plan.tag]));
    success(`Tagged ${plan.tag}`);
    pushed = true;
    runVisible("Push", "git", ["push", "--atomic", "origin", "main", plan.tag]);
    success(`Pushed main and ${plan.tag} to origin`);
  } catch (error) {
    console.log();
    failure(error.message);
    if (pushed) settleFailedPush(plan, undo);
    else rollback(plan, undo);
    process.exit(1);
  }
};

const findRun = async (tag) => {
  const filters = ["--workflow", WORKFLOW, "--branch", tag, "--event", "push"];
  const fields = ["--json", "databaseId,url", "--limit", "1"];
  let listed;
  for (let attempt = 0; attempt < RUN_LOOKUPS; attempt += 1) {
    listed = run("gh", ["run", "list", ...filters, ...fields]);
    const [first] = listed.status === 0 ? JSON.parse(listed.stdout) : [];
    if (first !== undefined) return first;
    await sleep(2000);
  }
  if (listed.status !== 0) failure(`gh run list failed: ${listed.stderr.trim()}`);
  return null;
};

const follow = async (tag) => {
  const repoUrl = output("gh", ["repo", "view", "--json", "url", "--jq", ".url"]);
  muted(`Waiting for GitHub to start ${WORKFLOW}…`);
  const found = await findRun(tag);
  const runUrl = found?.url ?? `${repoUrl}/actions/workflows/${WORKFLOW}`;
  box(`Workflow  ${runUrl}`, `Release   ${repoUrl}/releases/tag/${tag}`);
  if (found === null) {
    muted(`The run has not appeared yet; list it with: gh run list --workflow ${WORKFLOW}`);
    return;
  }
  muted(`gh run watch ${found.databaseId} --exit-status`);
  if (confirm("Follow the run here?", "Watch")) {
    const watched = run(
      "gh",
      ["run", "watch", String(found.databaseId), "--exit-status"],
      "inherit",
    );
    process.exitCode = watched.status ?? 1;
  }
};

const main = async () => {
  const requested = process.argv[2];
  header("Otomat release");
  const missingTools = TOOLS.filter((tool) => !succeeds(tool, ["--version"]));
  if (missingTools.length > 0) refuse(missingToolProblems(missingTools));
  if (!spin("Fetching origin…", ROOT, "git", ["fetch", "--quiet", "--tags", "origin"])) {
    process.exit(1);
  }
  const problems = preflightProblems(gatherFacts());
  if (problems.length > 0) refuse(problems);
  const start = output("git", ["rev-parse", "--short", "HEAD"]);
  success(`main @ ${start} is clean and in sync with origin/main`);

  const current = parseVersion(JSON.parse(readFileSync(VERSION_FILE, "utf8")).version);
  if (current === null) {
    refuse([
      {
        message: `${VERSION_FILE_RELATIVE} carries no SemVer version.`,
        hint: "fix it on main first",
      },
    ]);
  }
  console.log();
  const next = chooseVersion(current, requested);
  const versionProblem = nextVersionProblem(current, next);
  if (versionProblem !== null) refuse([{ message: versionProblem, hint: "pick another version" }]);
  const tag = `v${next}`;
  const existing = tagProblems(tag, gatherTagFacts(tag));
  if (existing.length > 0) refuse(existing);

  const plan = describePlan({ current, next, tag, start });
  showPlan(plan);
  if (!confirm("Bump, check, commit, tag and push?", "Release")) {
    muted("Cancelled. Nothing changed.");
    return;
  }
  execute(plan);
  await follow(plan.tag);
};

try {
  await main();
} catch (error) {
  failure(error.message);
  process.exitCode = 1;
}
