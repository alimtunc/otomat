import {
  Button,
  EmptyState,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { SectionHeading } from "@web/components/settings/section-heading";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { useRemoteSession } from "@web/components/shell/remote-session/context";

import { DaemonUpdatePanel } from "./daemon-update-panel";
import { HostCapacityField } from "./host-capacity-field";
import { HostRow } from "./host-row";
import { InstancesPanel } from "./instances-panel";
import { RemoteHostActions } from "./remote-host-actions";
import { useExecutionHost } from "./use-execution-host";

const ALIAS_DATALIST_ID = "execution-host-ssh-aliases";

export function ExecutionHostSection() {
  const host = useExecutionHost();
  const remote = useRemoteSession();
  const form = useForm({
    defaultValues: { alias: host.snapshot.data?.remote_ssh_alias ?? "" },
    onSubmit: async ({ value }) => {
      if (host.pending !== null || value.alias.trim().length === 0) return;
      if (await host.configureRemote(value.alias.trim())) form.reset({ alias: value.alias.trim() });
    },
  });

  const limitsNote = (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="xs" className="self-start">
            How limits apply
          </Button>
        }
      />
      <PopoverContent className="max-w-sm p-3 text-xs text-text-secondary">
        Each host limits concurrent agent sessions across its projects. Lowering the limit lets
        active sessions finish; waiting sessions start when capacity becomes available.
      </PopoverContent>
    </Popover>
  );

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
        <div className="mt-4 rounded-lg border border-border-subtle bg-card p-4">
          <HostCapacityField hostId="local" hostLabel="this daemon" />
          {limitsNote}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        title="Execution hosts"
        description="Where repositories live and runs execute. The active host follows the selected project."
      />
      <QueryBoundary
        query={host.snapshot}
        pending={<Skeleton height={80} />}
        error={
          <p role="alert" className="text-xs text-danger">
            Could not load the execution-host state: {host.snapshot.error?.message}
          </p>
        }
      >
        {(snapshot) => (
          <div className="flex flex-col gap-4">
            <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-card">
              {snapshot.hosts.map((entry) => {
                return (
                  <div key={entry.id}>
                    <HostRow
                      host={entry}
                      active={snapshot.active_id === entry.id}
                      status={remote.status}
                      action={
                        entry.kind === "ssh" ? (
                          <RemoteHostActions
                            error={host.actionError}
                            pending={host.pending !== null}
                            onRemove={async () => {
                              const removed = await host.removeRemote();
                              if (removed) form.reset({ alias: "" });
                              return removed;
                            }}
                          />
                        ) : undefined
                      }
                    />
                    <div className="pr-4 pb-4 pl-11">
                      <HostCapacityField hostId={entry.id} hostLabel={entry.label} />
                    </div>
                  </div>
                );
              })}
            </div>
            {limitsNote}
            <DaemonUpdatePanel />
            <form
              className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <form.Field name="alias">
                {(field) => (
                  <Field>
                    <FieldLabel>Remote host SSH alias</FieldLabel>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <FieldControl>
                          <Input
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
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
                      <form.Subscribe selector={(state) => state.values.alias}>
                        {(alias) => (
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            loading={host.pending === "configure"}
                            disabled={
                              alias.trim().length === 0 ||
                              alias.trim() === (snapshot.remote_ssh_alias ?? "") ||
                              host.pending !== null
                            }
                          >
                            Save alias
                          </Button>
                        )}
                      </form.Subscribe>
                    </div>
                  </Field>
                )}
              </form.Field>
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
            <InstancesPanel sshAlias={snapshot.remote_ssh_alias} />
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
