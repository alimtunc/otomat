import { expect, it } from "vitest";

import { classifyProvenance } from "#github/import/provenance";
import { parsePullRequestReference } from "#github/import/reference";

import { providerPullRequest } from "../support/github.js";

const PROVIDER = providerPullRequest({
  number: 12,
  url: "https://github.com/acme/otomat/pull/12",
  title: "Fix it",
  body: null,
  headRef: "contrib/fix",
  headSha: "a".repeat(40),
  authorLogin: "contrib",
});

const BASE = { otomatBranches: [], otomatPublication: false, connectedLogin: "operator" } as const;

it("reads a bare number, a hash, a qualified reference and a github URL", () => {
  expect(parsePullRequestReference("12")).toEqual({ repository: null, number: 12 });
  expect(parsePullRequestReference(" #12 ")).toEqual({ repository: null, number: 12 });
  expect(parsePullRequestReference("acme/otomat#12")).toEqual({
    repository: "acme/otomat",
    number: 12,
  });
  expect(parsePullRequestReference("https://github.com/acme/otomat/pull/12/files")).toEqual({
    repository: "acme/otomat",
    number: 12,
  });
  expect(parsePullRequestReference("github.com/acme/otomat/pull/12")).toEqual({
    repository: "acme/otomat",
    number: 12,
  });
});

it("refuses anything it would have to guess at", () => {
  for (const raw of ["", "twelve", "https://gitlab.com/acme/otomat/pull/12", "acme/otomat"]) {
    expect(parsePullRequestReference(raw)).toBeNull();
  }
});

it("claims ownership only on local evidence", () => {
  expect(
    classifyProvenance({ ...BASE, provider: PROVIDER, otomatPublication: true }).provenance,
  ).toBe("otomat");
  expect(
    classifyProvenance({ ...BASE, provider: PROVIDER, otomatBranches: ["contrib/fix"] }).provenance,
  ).toBe("otomat");
});

it("calls another account's pull request external", () => {
  const verdict = classifyProvenance({ ...BASE, provider: PROVIDER });
  expect(verdict.provenance).toBe("external");
  expect(verdict.reason).toContain("@contrib");
});

it("keeps an unverifiable identity unknown rather than assuming one", () => {
  expect(
    classifyProvenance({ ...BASE, provider: { ...PROVIDER, authorLogin: null } }).provenance,
  ).toBe("unknown");
  expect(classifyProvenance({ ...BASE, provider: PROVIDER, connectedLogin: null }).provenance).toBe(
    "unknown",
  );
  // Same account, but no run here owns the branch: Otomat cannot claim it either way.
  expect(
    classifyProvenance({ ...BASE, provider: PROVIDER, connectedLogin: "contrib" }).provenance,
  ).toBe("unknown");
});
