import {
  countWorkspaces,
  type ExecutionHostSnapshot,
  type InboxSnapshot,
  type OtomatDesktopBridge,
  type WorkspaceInventory,
} from "@otomat/domain";

function emptyInventory(): WorkspaceInventory {
  return { entries: [], counts: countWorkspaces([]) };
}

function emptyInbox(): InboxSnapshot {
  return { entries: [], observed_at: "2026-08-22T10:00:00.000Z" };
}

export function twoHostSnapshot(
  overrides: Partial<ExecutionHostSnapshot> = {},
): ExecutionHostSnapshot {
  return {
    hosts: [
      { id: "local", label: "Local", kind: "local" },
      { id: "remote", label: "otomat-vps", kind: "ssh" },
    ],
    active_id: "local",
    remote_ssh_alias: "otomat-vps",
    remote_status: null,
    remote_build: null,
    expected_build: null,
    remote_update_error: null,
    ...overrides,
  };
}

export function fakeDesktopBridge(
  overrides: Partial<OtomatDesktopBridge> = {},
): OtomatDesktopBridge {
  return {
    daemonUrl: "http://127.0.0.1:5000",
    executionHostId: "local",
    executionHostSshAlias: null,
    build: { version: "0.0.0", commit: "abc1234", channel: "local" },
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
          remote_update_error: null,
        }),
      select: () => Promise.resolve({ ok: true as const, url: "http://127.0.0.1:5000" }),
      configureRemote: () => Promise.resolve({ ok: true as const }),
      removeRemote: () => Promise.resolve({ ok: true as const }),
      registerProject: () =>
        Promise.resolve({
          ok: true as const,
          project: {
            id: "p-new",
            name: "new-project",
            root_path: "/tmp/new-project",
            has_repository: true,
          },
        }),
      readCapacity: () =>
        Promise.resolve({
          ok: true as const,
          capacity: { max_concurrent_sessions: 4, active_sessions: 0, waiting_sessions: 0 },
        }),
      writeCapacity: (_hostId, maxConcurrentSessions) =>
        Promise.resolve({
          ok: true as const,
          capacity: {
            max_concurrent_sessions: maxConcurrentSessions,
            active_sessions: 0,
            waiting_sessions: 0,
          },
        }),
      listSshAliases: () => Promise.resolve([]),
      listRemoteRepositories: () => Promise.resolve({ ok: true as const, repositories: [] }),
      listProjects: () => Promise.resolve([]),
      listRepositories: () => Promise.resolve([]),
      deleteRepository: () => Promise.resolve({ ok: true as const }),
      readWorkspaces: () => Promise.resolve({ ok: true as const, value: emptyInventory() }),
      readInbox: () => Promise.resolve({ ok: true as const, value: emptyInbox() }),
      reconcileWorkspaces: () =>
        Promise.resolve({
          ok: true as const,
          value: {
            pull_requests_refreshed: 0,
            pruned: 0,
            converged: 0,
            cleaned: 0,
            skipped: 0,
            failed: 0,
            inventory: emptyInventory(),
          },
        }),
      cleanupWorkspace: () =>
        Promise.resolve({
          ok: true as const,
          value: { outcome: "cleaned" as const, blocker: null, message: "Deleted.", entry: null },
        }),
      onRemoteStatus: () => () => {},
      listInstances: () => Promise.resolve({ ok: true as const, instances: [] }),
      stopInstance: () => Promise.resolve({ ok: true as const }),
      deleteInstance: () => Promise.resolve({ ok: true as const }),
      updateRemoteDaemon: () => Promise.resolve({ ok: true as const }),
    },
    linear: {
      saveKey: () => Promise.resolve({ ok: true as const, message: null }),
      forgetKey: () => Promise.resolve({ ok: true as const, message: null }),
      delivery: () => Promise.resolve({ connections: [] }),
      onDelivery: () => () => {},
    },
    support: {
      exportBundle: () => Promise.resolve({ status: "written" as const, path: "/tmp/bundle.json" }),
      openReportDraft: () => Promise.resolve(),
    },
    update: {
      snapshot: () => Promise.resolve(null),
      check: () => Promise.resolve(),
      install: () => Promise.resolve(),
      onChange: () => () => {},
    },
    preview: false,
    sandbox: {
      reset: () => Promise.resolve({ ok: true as const, message: null }),
    },
    ...overrides,
  };
}
