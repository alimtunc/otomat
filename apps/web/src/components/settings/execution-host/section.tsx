import { Button, EmptyState, Field, FieldControl, FieldLabel, Input, Skeleton } from "@otomat/ui";
import { SectionHeading } from "@web/components/settings/section-heading";
import { useState, type ReactNode } from "react";

import { HostRow } from "./host-row";
import { useExecutionHost } from "./use-execution-host";

const ALIAS_DATALIST_ID = "execution-host-ssh-aliases";

export function ExecutionHostSection() {
  const host = useExecutionHost();
  const [aliasDraft, setAliasDraft] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  if (!host.isDesktop) {
    return (
      <div>
        <SectionHeading
          title="Execution host"
          description="Where repositories live and runs execute."
        />
        <EmptyState
          icon="monitor"
          variant="inline"
          title="Managed by the desktop app"
          description="In the browser the cockpit always talks to the daemon it was started against. Host selection lives in the Otomat desktop app."
        />
      </div>
    );
  }

  const snapshot = host.snapshot.data;
  const snapshotError = host.snapshot.error;
  const alias = aliasDraft ?? snapshot?.remote_ssh_alias ?? "";

  if (snapshotError !== null) {
    return (
      <div>
        <SectionHeading
          title="Execution host"
          description="Where repositories live and runs execute."
        />
        <p role="alert" className="text-xs text-danger">
          Could not load the execution-host state: {snapshotError.message}
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        title="Execution hosts"
        description="Where repositories live and runs execute: this machine, or a server you own reached over an SSH tunnel. The active host follows the project you pick in the switcher. The remote daemon stays bound to loopback — only the tunnel reaches it, and Otomat never stores SSH credentials."
      />
      {snapshot === undefined ? (
        <Skeleton height={80} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-card">
            {snapshot.hosts.map((entry) => {
              let action: ReactNode;
              if (entry.kind === "ssh" && confirmingRemove) {
                action = (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="destructive"
                      size="xs"
                      loading={host.pending === "remove"}
                      onClick={() =>
                        void host.removeRemote().then((removed) => {
                          if (removed) setConfirmingRemove(false);
                          setAliasDraft(null);
                        })
                      }
                    >
                      Remove host
                    </Button>
                    <Button
                      autoFocus
                      variant="ghost"
                      size="xs"
                      onClick={() => setConfirmingRemove(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                );
              } else if (entry.kind === "ssh") {
                action = (
                  <Button variant="ghost" size="xs" onClick={() => setConfirmingRemove(true)}>
                    Remove
                  </Button>
                );
              }
              return (
                <HostRow
                  key={entry.id}
                  host={entry}
                  active={snapshot.active_id === entry.id}
                  status={host.remoteStatus}
                  action={action}
                />
              );
            })}
          </div>
          {confirmingRemove ? (
            <p role="alert" className="text-xs text-warning">
              Removing the host closes the tunnel and forgets the SSH alias — its projects leave the
              switcher. Nothing is deleted on the server: the daemon, its projects and runs stay
              under ~/.otomat there, and adding the alias again brings them back.
            </p>
          ) : null}
          {snapshot.remote_build !== null &&
          snapshot.expected_build !== null &&
          snapshot.remote_build !== snapshot.expected_build ? (
            <p role="alert" className="text-xs text-warning">
              The remote daemon runs build {snapshot.remote_build} but this app expects{" "}
              {snapshot.expected_build}. Otomat restarts it automatically once it has no active
              runs; if this warning persists, the deployed files are still the old build — redeploy
              on the host:{" "}
              <code className="font-mono">
                pnpm --filter @otomat/local-daemon deploy --prod --legacy ~/.otomat/daemon
              </code>
            </p>
          ) : null}
          <form
            className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void host.configureRemote(alias.trim()).then((saved) => {
                if (saved) setAliasDraft(null);
              });
            }}
          >
            <Field>
              <FieldLabel>Remote host SSH alias</FieldLabel>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <FieldControl>
                    <Input
                      value={alias}
                      onChange={(event) => setAliasDraft(event.target.value)}
                      placeholder="otomat-vps"
                      aria-label="Remote host SSH alias"
                      list={ALIAS_DATALIST_ID}
                      spellCheck={false}
                    />
                  </FieldControl>
                  <datalist id={ALIAS_DATALIST_ID}>
                    {host.aliases.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={host.pending === "configure"}
                  disabled={alias.trim().length === 0 || host.pending !== null}
                >
                  Save
                </Button>
              </div>
            </Field>
            <p className="text-xs text-text-tertiary">
              A concrete Host entry from your ~/.ssh/config — authentication stays in your SSH
              setup. The host needs Node.js 22+ and the Otomat daemon deployed at
              ~/.otomat/daemon/dist/index.js.
            </p>
          </form>
          {host.actionError === null ? null : (
            <p role="alert" className="text-xs text-danger">
              {host.actionError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
