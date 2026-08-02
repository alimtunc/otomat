import type { OtomatDesktopBridge } from "@otomat/domain";

/** Complete desktop bridge double; override only what the test exercises. */
export function fakeDesktopBridge(
  overrides: Partial<OtomatDesktopBridge> = {},
): OtomatDesktopBridge {
  return {
    daemonUrl: "http://127.0.0.1:5000",
    executionHostId: "local",
    executionHostSshAlias: null,
    pickDirectory: () => Promise.resolve(null),
    executionHost: {
      snapshot: () =>
        Promise.resolve({
          hosts: [{ id: "local" as const, label: "Local", kind: "local" as const }],
          active_id: "local" as const,
          remote_ssh_alias: null,
          remote_status: null,
          remote_build: null,
          expected_build: null,
        }),
      select: () => Promise.resolve({ ok: true as const }),
      configureRemote: () => Promise.resolve({ ok: true as const }),
      listSshAliases: () => Promise.resolve([]),
      listProjects: () => Promise.resolve([]),
      onRemoteStatus: () => () => {},
    },
    linear: {
      saveKey: () => Promise.resolve({ ok: true as const, message: null }),
      forgetKey: () => Promise.resolve({ ok: true as const, message: null }),
    },
    ...overrides,
  };
}
