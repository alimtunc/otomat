// @vitest-environment happy-dom
import type { AgentProfileContract, SaveAgentProfileRequest } from "@otomat/domain";
import { useCreateAgentProfile } from "@web/api/agent-profiles/mutations";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { hostKeys } from "@web/api/query-keys";
import { activeHostStore } from "@web/lib/active-host";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { agentProfile } from "#support/agent";
import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";

const catalogs = new Map<string, string[]>();

vi.mock("@web/api/client", async () => {
  const { activeExecutionHostId } = await import("@web/lib/active-host");
  const owned = (): string[] => catalogs.get(activeExecutionHostId()) ?? [];
  return {
    daemon: {
      listAgentProfiles: (): Promise<AgentProfileContract[]> =>
        Promise.resolve(owned().map((name) => agentProfile({ id: name, name }))),
      createAgentProfile: (request: SaveAgentProfileRequest): Promise<AgentProfileContract> => {
        owned().push(request.name);
        return Promise.resolve(agentProfile({ id: request.name, name: request.name }));
      },
    },
  };
});

function Catalog() {
  const profiles = useAgentProfiles();
  const create = useCreateAgentProfile();
  return (
    <button type="button" onClick={() => create.mutate({ ...agentProfile(), name: "added" })}>
      {(profiles.data ?? []).map((profile) => profile.name).join(",")}
    </button>
  );
}

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  catalogs.set("local", ["local-only"]);
  catalogs.set("remote", ["vps-only"]);
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  activeHostStore.setState(() => null);
  catalogs.clear();
  delete window.otomat;
});

it("shows each host its own catalog and lets neither reach the other's", async () => {
  window.otomat = fakeDesktopBridge({ executionHostSshAlias: "otomat-vps" });
  const client = testQueryClient();
  const mounted = await mountWithQuery(<Catalog />, client);
  cleanups.push(mounted.cleanup);
  expect(mounted.container.textContent).toBe("local-only");

  await act(async () => {
    activeHostStore.actions.activate({ id: "remote", daemonUrl: "http://127.0.0.1:45010" });
  });
  await vi.waitFor(() => expect(mounted.container.textContent).toBe("vps-only"));

  await act(async () => {
    mounted.container.querySelector("button")?.click();
  });
  await vi.waitFor(() => expect(mounted.container.textContent).toBe("vps-only,added"));

  expect(catalogs.get("local")).toEqual(["local-only"]);
  expect(client.getQueryData(hostKeys("local").agentProfilesFor())).toEqual([
    agentProfile({ id: "local-only", name: "local-only" }),
  ]);

  await act(async () => {
    activeHostStore.actions.activate({ id: "local", daemonUrl: "http://127.0.0.1:5000" });
  });
  await vi.waitFor(() => expect(mounted.container.textContent).toBe("local-only"));
});
