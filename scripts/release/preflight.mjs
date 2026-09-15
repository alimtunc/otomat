const INSTALL = {
  git: "https://git-scm.com/downloads",
  gh: "brew install gh",
  gum: "brew install gum",
};

export function missingToolProblems(tools) {
  return tools.map((tool) => ({ message: `${tool} is not installed.`, hint: INSTALL[tool] }));
}

const syncProblem = ({ ahead, behind }) => {
  if (ahead > 0 && behind > 0) {
    return {
      message: `main has diverged from origin/main (${ahead} ahead, ${behind} behind).`,
      hint: "git rebase origin/main && git push origin main, then rerun once its CI is green",
    };
  }
  if (behind > 0) {
    return {
      message: `main is ${behind} commit(s) behind origin/main.`,
      hint: "git pull --ff-only",
    };
  }
  if (ahead > 0) {
    return {
      message: `main is ${ahead} commit(s) ahead of origin/main; a release ships what CI has already seen.`,
      hint: "git push origin main, then rerun once its CI is green",
    };
  }
  return null;
};

export function preflightProblems(facts) {
  const problems = [];
  if (!facts.ghAuthenticated) {
    problems.push({ message: "gh is not authenticated.", hint: "gh auth login" });
  }
  if (facts.branch !== "main") {
    problems.push({
      message: `A release is cut from main; this checkout is on ${facts.branch === "" ? "a detached HEAD" : facts.branch}.`,
      hint: "git switch main",
    });
  }
  if (facts.dirtyEntries.length > 0) {
    problems.push({
      message: `The worktree has ${facts.dirtyEntries.length} uncommitted change(s).`,
      hint: "git status — commit, stash or discard them first",
    });
  }
  const sync = syncProblem(facts);
  if (sync !== null) problems.push(sync);
  return problems;
}

export function tagProblems(tag, facts) {
  const problems = [];
  if (facts.remoteTags.includes(tag)) {
    problems.push({
      message: `Tag ${tag} already exists on origin.`,
      hint: "pick another version",
    });
  } else if (facts.localTags.includes(tag)) {
    problems.push({ message: `Tag ${tag} already exists locally.`, hint: `git tag -d ${tag}` });
  }
  if (facts.releaseExists) {
    problems.push({
      message: `GitHub release ${tag} already exists.`,
      hint: "pick another version",
    });
  }
  return problems;
}
