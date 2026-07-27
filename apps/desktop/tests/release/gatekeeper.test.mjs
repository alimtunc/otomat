import { expect, it, vi } from "vitest";

import {
  notarizeAndStapleDmg,
  readGatekeeperFacts,
  readSignatureFacts,
  verifySignedRelease,
} from "#release/gatekeeper";

const TEAM_ID = "AB12CD34EF";

const SIGNED_APP = `Executable=/Applications/Otomat.app/Contents/MacOS/Otomat
Identifier=com.otomat.desktop
Format=app bundle with Mach-O thin (arm64)
CodeDirectory v=20500 size=2048 flags=0x10000(runtime) hashes=64+7 location=embedded
Authority=Developer ID Application: Otomat (${TEAM_ID})
Authority=Developer ID Certification Authority
Authority=Apple Root CA
TeamIdentifier=${TEAM_ID}
Sealed Resources version=2 rules=13 files=204
`;

const ADHOC_APP = `Executable=/Applications/Otomat.app/Contents/MacOS/Otomat
Identifier=com.otomat.desktop
CodeDirectory v=20400 size=2048 flags=0x2(adhoc) hashes=64+7 location=embedded
Signature=adhoc
TeamIdentifier=not set
`;

const ACCEPTED = `/Applications/Otomat.app: accepted
source=Notarized Developer ID
origin=Developer ID Application: Otomat (${TEAM_ID})
`;

const REJECTED = `/Applications/Otomat.app: rejected
source=Unnotarized Developer ID
`;

function runner(overrides = {}) {
  return vi.fn((command, args) => {
    if (command === "codesign" && args[0] === "-dv") return overrides.codesign ?? SIGNED_APP;
    if (command === "spctl") return overrides.spctl ?? ACCEPTED;
    return "";
  });
}

function verify(overrides) {
  return verifySignedRelease({
    appPath: "/tmp/Otomat.app",
    dmgPath: "/tmp/Otomat.dmg",
    teamId: TEAM_ID,
    run: runner(overrides),
  });
}

it("reads the signing facts a Developer ID bundle states", () => {
  expect(readSignatureFacts(SIGNED_APP)).toEqual({
    developerId: true,
    hardenedRuntime: true,
    teamIdentifier: TEAM_ID,
  });
  expect(readSignatureFacts(ADHOC_APP)).toEqual({
    developerId: false,
    hardenedRuntime: false,
    teamIdentifier: null,
  });
});

it("reads whether Gatekeeper accepts the bundle as notarized", () => {
  expect(readGatekeeperFacts(ACCEPTED)).toEqual({ accepted: true, notarized: true });
  expect(readGatekeeperFacts(REJECTED)).toEqual({ accepted: false, notarized: false });
});

it("passes every check on a signed, hardened, notarized and stapled artifact", () => {
  const run = runner();
  const passed = verifySignedRelease({
    appPath: "/tmp/Otomat.app",
    dmgPath: "/tmp/Otomat.dmg",
    teamId: TEAM_ID,
    run,
  });

  expect(passed).toHaveLength(5);
  expect(run).toHaveBeenCalledWith("xcrun", ["stapler", "validate", "/tmp/Otomat.app"]);
  expect(run).toHaveBeenCalledWith("xcrun", ["stapler", "validate", "/tmp/Otomat.dmg"]);
});

it("refuses an ad-hoc signed artifact", () => {
  expect(() => verify({ codesign: ADHOC_APP })).toThrow(/Developer ID Application certificate/);
});

it("refuses an artifact signed without the hardened runtime", () => {
  const withoutRuntime = SIGNED_APP.replace("flags=0x10000(runtime)", "flags=0x0(none)");

  expect(() => verify({ codesign: withoutRuntime })).toThrow(/hardened runtime/);
});

it("refuses an artifact signed by another team", () => {
  const otherTeam = SIGNED_APP.replace(new RegExp(TEAM_ID, "g"), "ZZ99YY88XX");

  expect(() => verify({ codesign: otherTeam })).toThrow(/different team identifier/);
});

it("refuses an artifact Gatekeeper does not see as notarized", () => {
  expect(() => verify({ spctl: REJECTED })).toThrow(/Gatekeeper rejects the app/);
});

it("submits the DMG for notarization and staples the ticket onto it", () => {
  const run = vi.fn(() => "");
  notarizeAndStapleDmg({
    dmgPath: "/tmp/Otomat.dmg",
    signing: { apiKeyPath: "/tmp/key.p8", apiKeyId: "KEYID12345", apiIssuer: "issuer-uuid" },
    run,
  });

  expect(run.mock.calls[0][1]).toEqual([
    "notarytool",
    "submit",
    "/tmp/Otomat.dmg",
    "--key",
    "/tmp/key.p8",
    "--key-id",
    "KEYID12345",
    "--issuer",
    "issuer-uuid",
    "--wait",
    "--timeout",
    "30m",
  ]);
  expect(run.mock.calls[1]).toEqual(["xcrun", ["stapler", "staple", "/tmp/Otomat.dmg"]]);
});
