// Notarize + staple the DMG, then prove the artifact a clean machine will see is signed, hardened,
// notarized and stapled.

/** Facts `codesign -dv --verbose=4` states about a bundle. */
export function readSignatureFacts(codesignOutput) {
  const flags = /^CodeDirectory .*\bflags=(\S+)/m.exec(codesignOutput)?.[1] ?? "";
  return {
    developerId: /^Authority=Developer ID Application:/m.test(codesignOutput),
    hardenedRuntime: flags.includes("runtime"),
    // `TeamIdentifier=not set` cannot match, so an unsigned bundle reads as null.
    teamIdentifier: /^TeamIdentifier=(\S+)$/m.exec(codesignOutput)?.[1] ?? null,
  };
}

/** Facts `spctl --assess --type execute -vvv` states about a bundle. */
export function readGatekeeperFacts(spctlOutput) {
  return {
    accepted: /:\s+accepted$/m.test(spctlOutput),
    notarized: /^source=Notarized Developer ID$/m.test(spctlOutput),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(`Release verification failed: ${message}`);
}

/**
 * Submits the DMG to Apple and staples the returned ticket onto it, so the download validates
 * offline. electron-builder has already notarized and stapled the `.app` the DMG carries.
 *
 * @param {{ dmgPath: string, signing: { apiKeyPath: string, apiKeyId: string, apiIssuer: string },
 *   run: (command: string, args: string[]) => void }} input
 */
export function notarizeAndStapleDmg(input) {
  input.run("xcrun", [
    "notarytool",
    "submit",
    input.dmgPath,
    "--key",
    input.signing.apiKeyPath,
    "--key-id",
    input.signing.apiKeyId,
    "--issuer",
    input.signing.apiIssuer,
    "--wait",
    "--timeout",
    "30m",
  ]);
  input.run("xcrun", ["stapler", "staple", input.dmgPath]);
}

/**
 * @param {{ appPath: string, dmgPath: string, teamId: string,
 *   run: (command: string, args: string[], options?: { allowFailure?: boolean }) => string }} input
 * @returns {string[]} the checks that passed, in order
 */
export function verifySignedRelease(input) {
  const passed = [];

  input.run("codesign", ["--verify", "--deep", "--strict", input.appPath]);
  passed.push("app signature is internally consistent");

  const signature = readSignatureFacts(
    input.run("codesign", ["-dv", "--verbose=4", input.appPath]),
  );
  assert(signature.developerId, "the app is not signed by a Developer ID Application certificate.");
  assert(signature.hardenedRuntime, "the app is not signed with the hardened runtime enabled.");
  assert(
    signature.teamIdentifier === input.teamId,
    "the app carries a different team identifier than APPLE_TEAM_ID.",
  );
  passed.push("app is Developer ID signed, hardened, and owned by the configured team");

  // spctl exits non-zero on rejection, so its verdict has to be read from the output, not the code.
  const gatekeeper = readGatekeeperFacts(
    input.run("spctl", ["--assess", "--type", "execute", "-vvv", input.appPath], {
      allowFailure: true,
    }),
  );
  assert(gatekeeper.accepted, "Gatekeeper rejects the app.");
  assert(gatekeeper.notarized, "Gatekeeper does not see the app as notarized.");
  passed.push("Gatekeeper accepts the app as notarized");

  input.run("xcrun", ["stapler", "validate", input.appPath]);
  passed.push("app carries a stapled notarization ticket");

  input.run("codesign", ["--verify", "--strict", input.dmgPath]);
  input.run("xcrun", ["stapler", "validate", input.dmgPath]);
  passed.push("DMG is signed and carries a stapled notarization ticket");

  return passed;
}
