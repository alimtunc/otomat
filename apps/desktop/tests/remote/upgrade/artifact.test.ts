import { expect, it } from "vitest";

import {
  artifactAvailabilityScript,
  describeArtifactFailure,
  describeArtifactTimeout,
  describeArtifactWait,
  parseArtifactAvailability,
} from "#main/remote/upgrade/artifact";

const OPTIONS = { build: "2f55965", repo: "alimtunc/otomat" };

it("asks for the artifact this build is named after, in the repository it was told", () => {
  const script = artifactAvailabilityScript(OPTIONS);

  expect(script).toContain('NAME="otomat-daemon-2f55965-linux-x64"');
  expect(script).toContain("repos/alimtunc/otomat/actions/artifacts?name=$NAME");
});

it("skips an artifact whose content has expired, which the listing still returns", () => {
  const script = artifactAvailabilityScript(OPTIONS);

  expect(script).toContain("select(.expired | not)");
  expect(script).not.toContain(".artifacts[0].id");
});

it("falls back to the workflow run of that commit, matched on its short sha", () => {
  const script = artifactAvailabilityScript(OPTIONS);

  expect(script).toContain("repos/alimtunc/otomat/actions/workflows/ci.yml/runs?event=push");
  expect(script).toContain('startswith("2f55965")');
  expect(script).toContain('[.status, .conclusion // "none"] | join(":")');
});

it("asks only the workflow that publishes the bundle, never a release or a PR run", () => {
  const script = artifactAvailabilityScript(OPTIONS);

  expect(script).not.toContain("actions/runs?");
  expect(script).toContain("event=push");
});

it("reads only: nothing on the host may be stopped or replaced to answer this", () => {
  const script = artifactAvailabilityScript(OPTIONS);

  for (const forbidden of ["nohup", "kill", "mv ", "tar ", "daemon.prev"]) {
    expect(script).not.toContain(forbidden);
  }
});

it.each([
  ["OTOMAT_ARTIFACT:READY:otomat-daemon-2f55965-linux-x64", { kind: "ready" }],
  ["OTOMAT_ARTIFACT:WORKFLOW:none", { kind: "pending", reason: "no_run" }],
  ["OTOMAT_ARTIFACT:WORKFLOW:queued:none", { kind: "pending", reason: "queued" }],
  ["OTOMAT_ARTIFACT:WORKFLOW:waiting:none", { kind: "pending", reason: "queued" }],
  ["OTOMAT_ARTIFACT:WORKFLOW:in_progress:none", { kind: "pending", reason: "in_progress" }],
  ["OTOMAT_ARTIFACT:WORKFLOW:completed:success", { kind: "pending", reason: "not_published" }],
  [
    "OTOMAT_ARTIFACT:WORKFLOW:completed:failure",
    { kind: "workflow_failed", conclusion: "failure" },
  ],
  [
    "OTOMAT_ARTIFACT:WORKFLOW:completed:cancelled",
    { kind: "workflow_failed", conclusion: "cancelled" },
  ],
  ["OTOMAT_ARTIFACT:NO_GH:-", { kind: "gh_missing" }],
  ["OTOMAT_ARTIFACT:QUERY_FAILED:HTTP 401 ", { kind: "query_failed", detail: "HTTP 401" }],
])("parses %s", (line, availability) => {
  expect(parseArtifactAvailability(line)).toEqual(availability);
});

it.each(["", "OTOMAT_ARTIFACT:READY:", "OTOMAT_ARTIFACT:SOMETHING:x", "no token at all"])(
  "returns null for unusable output %j rather than a state",
  (stdout) => {
    expect(parseArtifactAvailability(stdout)).toBeNull();
  },
);

it("keeps the last token, so a login banner cannot be mistaken for an answer", () => {
  const stdout = [
    "Welcome to Ubuntu 24.04 LTS",
    "OTOMAT_ARTIFACT:WORKFLOW:in_progress:none",
    "OTOMAT_ARTIFACT:READY:otomat-daemon-2f55965-linux-x64",
    "",
  ].join("\n");

  expect(parseArtifactAvailability(stdout)).toEqual({ kind: "ready" });
});

it("says what a wait is holding for, without calling any of it a failure", () => {
  expect(describeArtifactWait("in_progress")).toBe("its CI run is still running");
  expect(describeArtifactWait("not_published")).toContain("still being uploaded");
  expect(describeArtifactWait("unreadable")).toContain("could not reach GitHub Actions");
  for (const reason of [
    "no_run",
    "queued",
    "in_progress",
    "not_published",
    "unreadable",
  ] as const) {
    expect(describeArtifactWait(reason)).not.toMatch(/fail|error/i);
  }
});

it("ends a spent wait on what CI owes and what to do about it", () => {
  expect(describeArtifactTimeout("no_run", "2f55965")).toContain("no CI run for build 2f55965");
  expect(describeArtifactTimeout("in_progress", "2f55965")).toContain("install again");
  expect(describeArtifactTimeout("not_published", "2f55965")).toContain(
    "otomat-daemon-2f55965-linux-x64",
  );
});

it("names the conclusion a workflow ended on, and the host tool a probe needs", () => {
  expect(
    describeArtifactFailure({ kind: "workflow_failed", conclusion: "failure" }, "2f55965"),
  ).toBe(
    "the CI run for build 2f55965 ended as failure, so no bundle was published. Re-run it on GitHub, then install again.",
  );
  expect(describeArtifactFailure({ kind: "gh_missing" }, "2f55965")).toContain("`gh` CLI");
  expect(
    describeArtifactFailure({ kind: "query_failed", detail: "HTTP 403" }, "2f55965"),
  ).toContain("HTTP 403");
});
