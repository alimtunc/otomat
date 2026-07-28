// Resolves the macOS signing/notarization inputs from the environment and fails closed with
// setup diagnostics when they are absent. Values are never read into a message: every diagnostic
// names the variable and the repository secret that feeds it, never its content.

/** Every input the signed release needs, with the repository secret that supplies it. */
export const SIGNING_INPUTS = [
  {
    variable: "CSC_LINK",
    secret: "MACOS_CERTIFICATE_P12_BASE64",
    detail: "base64 of the Developer ID Application certificate exported as .p12",
  },
  {
    variable: "CSC_KEY_PASSWORD",
    secret: "MACOS_CERTIFICATE_PASSWORD",
    detail: "password chosen when that .p12 was exported",
  },
  {
    variable: "APPLE_TEAM_ID",
    secret: "APPLE_TEAM_ID",
    detail: "10-character Apple Developer Team ID",
  },
  {
    variable: "APPLE_API_KEY",
    secret: "APPLE_API_KEY_P8_BASE64",
    detail: "filesystem path to the decoded App Store Connect .p8 key",
  },
  {
    variable: "APPLE_API_KEY_ID",
    secret: "APPLE_API_KEY_ID",
    detail: "key id of that App Store Connect key",
  },
  {
    variable: "APPLE_API_ISSUER",
    secret: "APPLE_API_ISSUER",
    detail: "issuer id of the App Store Connect key",
  },
];

const TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;

function present(env, variable) {
  const value = env[variable];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {(path: string) => boolean} fileExists
 * @returns {{ ok: true, signing: { teamId: string, apiKeyPath: string, apiKeyId: string, apiIssuer: string } }
 *   | { ok: false, problems: string[] }}
 */
export function resolveSigningEnvironment(env, fileExists) {
  const problems = SIGNING_INPUTS.filter((input) => !present(env, input.variable)).map(
    (input) =>
      `${input.variable} is not set — provide the ${input.secret} secret (${input.detail}).`,
  );
  if (problems.length > 0) return { ok: false, problems };

  const teamId = env.APPLE_TEAM_ID.trim();
  const apiKeyPath = env.APPLE_API_KEY.trim();
  if (!TEAM_ID_PATTERN.test(teamId)) {
    problems.push(
      "APPLE_TEAM_ID is not a 10-character Apple Developer Team ID — copy it from the Apple Developer membership page.",
    );
  }
  if (!fileExists(apiKeyPath)) {
    problems.push(
      "APPLE_API_KEY does not point at an existing file — decode APPLE_API_KEY_P8_BASE64 to that path before releasing.",
    );
  }
  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    signing: {
      teamId,
      apiKeyPath,
      apiKeyId: env.APPLE_API_KEY_ID.trim(),
      apiIssuer: env.APPLE_API_ISSUER.trim(),
    },
  };
}

/** Human-readable setup guidance for a failed resolution; safe to print in CI logs. */
export function formatSigningProblems(problems) {
  return [
    "The signed macOS release cannot start: its Apple credentials are incomplete.",
    ...problems.map((problem) => `  - ${problem}`),
    "",
    "Configure the repository secrets listed in docs/release/macos-alpha.md, then re-run.",
    "`pnpm desktop:package` still produces the unsigned local artifact without any credential.",
  ].join("\n");
}
