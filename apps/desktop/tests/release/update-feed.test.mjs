import { expect, it } from "vitest";

import { assertUpdateFeed, githubPublishConfig, UPDATE_REPO } from "#release/update-feed";
import { OTOMAT_GITHUB_REPO } from "#shared/constants";

const ZIP = "Otomat-0.1.0-alpha.2-arm64-mac.zip";
const DIGEST = "Zm9ydHktdHdv";

const FEED = `version: 0.1.0-alpha.2
files:
  - url: ${ZIP}
    sha512: ${DIGEST}
    size: 128
path: ${ZIP}
sha512: ${DIGEST}
releaseDate: '2026-08-22T09:00:00.000Z'
`;

function verify(overrides = {}) {
  return assertUpdateFeed({
    feedText: FEED,
    version: "0.1.0-alpha.2",
    present: new Set([ZIP, "latest-mac.yml"]),
    digestOf: () => DIGEST,
    ...overrides,
  });
}

it("publishes the feed against the repository the app follows", () => {
  expect(`${UPDATE_REPO.owner}/${UPDATE_REPO.repo}`).toBe(OTOMAT_GITHUB_REPO);
  expect(githubPublishConfig()).toEqual({
    provider: "github",
    owner: UPDATE_REPO.owner,
    repo: UPDATE_REPO.repo,
  });
});

it("accepts a feed that matches the build, naming each artifact once", () => {
  expect(verify()).toEqual([ZIP]);
});

it("refuses a feed announcing another version", () => {
  expect(() => verify({ version: "0.1.0-alpha.3" })).toThrow(/announces version 0\.1\.0-alpha\.2/);
});

it("refuses a feed pointing at an artifact this build did not produce", () => {
  expect(() => verify({ present: new Set(["latest-mac.yml"]) })).toThrow(/points at .*\.zip/);
});

it("refuses a feed whose digest is not the artifact's", () => {
  expect(() => verify({ digestOf: () => "c29tZXRoaW5nLWVsc2U=" })).toThrow(/digest that is not/);
});

it("refuses a feed that names nothing to download", () => {
  expect(() => verify({ feedText: "version: 0.1.0-alpha.2\n" })).toThrow(/names no artifact/);
});
