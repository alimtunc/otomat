import type { ExecutionHostDescriptor, ExecutionHostId, RemoteHostStatus } from "@otomat/domain";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  FieldControl,
  FieldLabel,
  Icon,
  Input,
  Skeleton,
} from "@otomat/ui";
import { SectionHeading } from "@web/components/settings/section-heading";
import { useState } from "react";

import { describeRemoteStatus } from "./status-labels";
import { useExecutionHost } from "./use-execution-host";

const ALIAS_DATALIST_ID = "execution-host-ssh-aliases";

const STATUS_TONES: Partial<Record<RemoteHostStatus["phase"], string>> = {
  connected: "text-text-secondary",
  error: "text-danger",
};

function RemoteStatusLine({ status }: { status: RemoteHostStatus | null }) {
  if (status === null) return null;
  const tone = STATUS_TONES[status.phase] ?? "text-text-tertiary";
  return (
    <p role="status" className={`text-xs ${tone}`}>
      {describeRemoteStatus(status)}
    </p>
  );
}

function HostRow({
  host,
  active,
  status,
  pending,
  onSelect,
}: {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  pending: boolean;
  onSelect: (id: ExecutionHostId) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <Icon
        name={host.kind === "ssh" ? "terminal" : "monitor"}
        aria-hidden
        className="mt-0.5 h-4 w-4 text-text-tertiary"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{host.label}</span>
          <span className="text-xs text-text-tertiary">
            {host.kind === "ssh" ? "SSH tunnel · daemon on the host" : "This machine"}
          </span>
          {active ? <Badge>Active</Badge> : null}
        </div>
        {host.kind === "ssh" ? <RemoteStatusLine status={status} /> : null}
      </div>
      {active ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={pending}
          disabled={pending}
          onClick={() => onSelect(host.id)}
        >
          Use this host
        </Button>
      )}
    </div>
  );
}

export function ExecutionHostSection() {
  const host = useExecutionHost();
  const [aliasDraft, setAliasDraft] = useState<string | null>(null);

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
        title="Execution host"
        description="Where repositories live and runs execute: this machine, or a server you own reached over an SSH tunnel. The remote daemon stays bound to loopback — only the tunnel reaches it, and Otomat never stores SSH credentials."
      />
      {snapshot === undefined ? (
        <Skeleton height={80} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-card">
            {snapshot.hosts.map((entry) => (
              <HostRow
                key={entry.id}
                host={entry}
                active={snapshot.active_id === entry.id}
                status={host.remoteStatus}
                pending={host.pending === entry.id}
                onSelect={(id) => void host.select(id)}
              />
            ))}
          </div>
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
