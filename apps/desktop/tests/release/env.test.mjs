import { expect, it } from "vitest";

import { formatSigningProblems, resolveSigningEnvironment, SIGNING_INPUTS } from "#release/env";

const COMPLETE = {
  CSC_LINK: "cert-material-that-must-never-be-logged",
  CSC_KEY_PASSWORD: "password-that-must-never-be-logged",
  APPLE_TEAM_ID: "AB12CD34EF",
  APPLE_API_KEY: "/runner/temp/apple-api-key.p8",
  APPLE_API_KEY_ID: "KEYID12345",
  APPLE_API_ISSUER: "11111111-2222-3333-4444-555555555555",
};

const alwaysExists = () => true;

it("resolves the notarization inputs when every credential is configured", () => {
  const resolved = resolveSigningEnvironment(COMPLETE, alwaysExists);

  expect(resolved).toEqual({
    ok: true,
    signing: {
      teamId: "AB12CD34EF",
      apiKeyPath: "/runner/temp/apple-api-key.p8",
      apiKeyId: "KEYID12345",
      apiIssuer: "11111111-2222-3333-4444-555555555555",
    },
  });
});

it("names every missing input and the secret that feeds it", () => {
  const resolved = resolveSigningEnvironment({}, alwaysExists);

  expect(resolved.ok).toBe(false);
  expect(resolved.problems).toHaveLength(SIGNING_INPUTS.length);
  for (const input of SIGNING_INPUTS) {
    expect(resolved.problems.join("\n")).toContain(input.secret);
  }
});

it("treats a blank credential as missing", () => {
  const resolved = resolveSigningEnvironment(
    { ...COMPLETE, CSC_KEY_PASSWORD: "   " },
    alwaysExists,
  );

  expect(resolved.ok).toBe(false);
  expect(resolved.problems).toEqual([expect.stringContaining("MACOS_CERTIFICATE_PASSWORD")]);
});

it("rejects a team id that is not the 10-character Apple team id", () => {
  const resolved = resolveSigningEnvironment({ ...COMPLETE, APPLE_TEAM_ID: "team" }, alwaysExists);

  expect(resolved.ok).toBe(false);
  expect(resolved.problems).toEqual([expect.stringContaining("APPLE_TEAM_ID")]);
});

it("rejects an App Store Connect key path that was never materialized", () => {
  const resolved = resolveSigningEnvironment(COMPLETE, () => false);

  expect(resolved.ok).toBe(false);
  expect(resolved.problems).toEqual([expect.stringContaining("APPLE_API_KEY_P8_BASE64")]);
});

it("never leaks a credential value into the diagnostics it prints", () => {
  const misconfigured = { ...COMPLETE, APPLE_TEAM_ID: "wrong-team-id-value" };
  const printed = formatSigningProblems(
    resolveSigningEnvironment(misconfigured, () => false).problems,
  );

  for (const secret of Object.values(misconfigured)) {
    expect(printed).not.toContain(secret);
  }
  expect(printed).toContain("docs/release/macos-alpha.md");
});
