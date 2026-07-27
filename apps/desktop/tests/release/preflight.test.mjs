import { expect, it } from "vitest";

import { preflight } from "#release/preflight";

const COMPLETE = {
  CSC_LINK: "cert-material",
  CSC_KEY_PASSWORD: "cert-password",
  APPLE_TEAM_ID: "AB12CD34EF",
  APPLE_API_KEY: "/runner/temp/apple-api-key.p8",
  APPLE_API_KEY_ID: "KEYID12345",
  APPLE_API_ISSUER: "11111111-2222-3333-4444-555555555555",
};

function gate(overrides = {}) {
  return preflight({
    env: COMPLETE,
    arch: "arm64",
    version: "0.1.0-alpha.1",
    fileExists: () => true,
    ...overrides,
  });
}

it("hands the release its signing inputs when everything checks out", () => {
  expect(gate().teamId).toBe("AB12CD34EF");
});

it("stops the release with setup guidance when a credential is missing", () => {
  expect(() => gate({ env: {} })).toThrow(/docs\/release\/macos-alpha\.md/);
});

it("stops the release on an architecture this pipeline cannot build", () => {
  expect(() => gate({ arch: "x64" })).toThrow(/this host is x64/);
});

it("stops the release when the tag and the packaged version disagree", () => {
  const env = { ...COMPLETE, GITHUB_REF: "refs/tags/v9.9.9" };

  expect(() => gate({ env })).toThrow(/does not match the packaged version/);
});
