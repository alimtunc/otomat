import type { ExecutionHostId } from "@otomat/domain";
import { expect, it } from "vitest";

import { linearTargets, type LinearHostSource } from "#main/linear/targets";

function hosts(
  remoteSshAlias: string | null,
  urls: Partial<Record<ExecutionHostId, string>>,
): LinearHostSource {
  return {
    remoteSshAlias,
    catalog: {
      resolveEndpoint: (hostId) => {
        const baseUrl = urls[hostId];
        if (baseUrl === undefined) return { message: `${hostId} is not connected yet.` };
        return { baseUrl, token: `${hostId}-token` };
      },
    },
  };
}

it("targets only the local daemon while no remote host is configured", () => {
  expect(linearTargets(hosts(null, { local: "http://127.0.0.1:4319" }))).toEqual([
    {
      id: "local",
      label: "Local",
      endpoint: { baseUrl: "http://127.0.0.1:4319", token: "local-token" },
      unavailable: null,
    },
  ]);
});

it("carries the reason a configured host cannot take the key", () => {
  const targets = linearTargets(hosts("otomat-vps", { local: "http://127.0.0.1:4319" }));

  expect(targets).toHaveLength(2);
  expect(targets[1]).toEqual({
    id: "remote",
    label: "otomat-vps",
    endpoint: null,
    unavailable: "remote is not connected yet.",
  });
});

it("names each host's own daemon so neither can fall back to the other", () => {
  const targets = linearTargets(
    hosts("otomat-vps", { local: "http://127.0.0.1:4319", remote: "http://127.0.0.1:45010" }),
  );

  expect(targets.map((target) => target.endpoint)).toEqual([
    { baseUrl: "http://127.0.0.1:4319", token: "local-token" },
    { baseUrl: "http://127.0.0.1:45010", token: "remote-token" },
  ]);
});
