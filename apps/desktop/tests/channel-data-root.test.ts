import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveChannelDataRoot } from "#main/channel-data-root";
import { parseBuildInfo, type BuildInfo } from "#shared/build-info";
import type { DesktopChannel, PackagedChannel } from "#shared/channel";
import { APP_DATA_ROOT_ENV } from "#shared/constants";

const APP_DATA = "/appdata";

function rootFor(channel: DesktopChannel, prNumber: number | null = null): string | null {
  return resolveChannelDataRoot({ channel, prNumber, appData: APP_DATA, env: {} });
}

/** Metadata as packaging writes it, so the roots below are resolved from a real parsed build. */
function packagedBuild(channel: PackagedChannel, commit: string, pr: number | null): BuildInfo {
  return parseBuildInfo(
    JSON.stringify({
      version: "0.1.0-alpha.1",
      commit,
      commit_short: commit.slice(0, 7),
      committed_at: "2026-07-27T21:00:00+02:00",
      arch: "arm64",
      platform: "darwin",
      electron: "43.2.0",
      signed: channel === "stable",
      channel,
      pr_number: pr,
    }),
  );
}

describe("resolveChannelDataRoot", () => {
  it("leaves the stable install and dev checkouts where they already are", () => {
    expect(rootFor("stable")).toBeNull();
    expect(rootFor("dev")).toBeNull();
  });

  it("gives the local channel its own root beside the stable install", () => {
    expect(rootFor("local")).toBe(join(APP_DATA, "Otomat Local"));
    expect(rootFor("local")).not.toBe(join(APP_DATA, "Otomat"));
  });

  it("opens one profile for two local builds made from different commits", () => {
    const first = packagedBuild("local", "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", null);
    const second = packagedBuild("local", "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", null);

    const firstRoot = rootFor(first.channel, first.pr_number);
    const secondRoot = rootFor(second.channel, second.pr_number);

    expect(first.commit_short).not.toBe(second.commit_short);
    expect(firstRoot).toBe(secondRoot);
    expect(firstRoot).toBe(join(APP_DATA, "Otomat Local"));
  });

  it("splits previews per pull request, and keeps them out of local and stable", () => {
    const seventyNine = rootFor("preview", 79);

    expect(seventyNine).toBe(join(APP_DATA, "Otomat Preview PR 79"));
    expect(rootFor("preview", 80)).toBe(join(APP_DATA, "Otomat Preview PR 80"));
    expect(seventyNine).not.toBe(rootFor("preview", 80));
    expect(seventyNine).not.toBe(rootFor("local"));
    expect(seventyNine).not.toBe(join(APP_DATA, "Otomat"));
  });

  it("isolates a build that declared no channel from every channel that has data", () => {
    const unknown = rootFor("unknown");

    expect(unknown).toBe(join(APP_DATA, "Otomat Unknown"));
    expect(unknown).not.toBe(rootFor("local"));
    expect(unknown).not.toBeNull();
  });

  it("resolves under the appData override the packaged smoke points elsewhere", () => {
    const root = resolveChannelDataRoot({
      channel: "local",
      prNumber: null,
      appData: APP_DATA,
      env: { [APP_DATA_ROOT_ENV]: "/scratch/appdata" },
    });

    expect(root).toBe(join("/scratch/appdata", "Otomat Local"));
  });

  it("refuses a relative override rather than creating a root somewhere unexpected", () => {
    expect(() =>
      resolveChannelDataRoot({
        channel: "local",
        prNumber: null,
        appData: APP_DATA,
        env: { [APP_DATA_ROOT_ENV]: "scratch" },
      }),
    ).toThrow(/must be an absolute path/);
  });
});
