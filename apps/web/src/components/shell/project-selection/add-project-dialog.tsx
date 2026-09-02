import { isExecutionHostId, type ExecutionHostId } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  SegmentedControl,
  SegmentedItem,
  toast,
} from "@otomat/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { hostKeys, shellKeys } from "@web/api/query-keys";
import {
  registerRepositoryErrorMessage,
  useRegisterRepository,
} from "@web/api/repositories/mutations";
import { projectSwitcherKey } from "@web/components/shell/project-selection/host-key";
import { RemoteRepositoryPicker } from "@web/components/shell/project-selection/remote-repository-picker";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { useState } from "react";

export interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hosts: Array<{ id: ExecutionHostId; label: string; active: boolean }>;
  onSelect: (switcherId: string) => void;
}

export function AddProjectDialog({ open, onOpenChange, hosts, onSelect }: AddProjectDialogProps) {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const browserRegister = useRegisterRepository();
  const [error, setError] = useState<string | null>(null);

  const activeHostId = hosts.find((entry) => entry.active)?.id ?? "local";
  const multiHost = bridge !== null && hosts.length > 1;
  const labelOf = (id: ExecutionHostId): string =>
    hosts.find((entry) => entry.id === id)?.label ?? "Local";

  const form = useForm({
    defaultValues: { hostId: activeHostId, path: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const path = value.path.trim();
      const registered = (projectId: string, name: string): void => {
        const keys = hostKeys(value.hostId);
        void client.invalidateQueries({ queryKey: shellKeys.executionHost });
        void client.invalidateQueries({ queryKey: keys.projects });
        void client.invalidateQueries({ queryKey: keys.repositories });
        toast.success(`${name} added on ${labelOf(value.hostId)}`);
        close();
        onSelect(projectSwitcherKey(value.hostId, projectId));
      };
      try {
        if (bridge !== null) {
          const result = await bridge.executionHost.registerProject(value.hostId, path);
          if (result.ok) registered(result.project.id, result.project.name);
          else setError(result.message);
          return;
        }
        const response = await browserRegister.mutateAsync({ path });
        registered(response.project.id, response.project.name);
      } catch (submitError) {
        setError(registerRepositoryErrorMessage(submitError));
      }
    },
  });

  const hostId = useStore(form.store, (state) => state.values.hostId);

  const close = (): void => {
    form.reset();
    setError(null);
    onOpenChange(false);
  };

  const browse = async (): Promise<void> => {
    if (bridge === null) return;
    try {
      const picked = await bridge.pickDirectory();
      if (picked !== null) form.setFieldValue("path", picked);
    } catch {
      setError("Could not open the folder picker.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent aria-label="Add project">
        <DialogHeader>
          <DialogTitle>Add project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form
            id="add-project-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            {multiHost ? (
              <form.Field name="hostId">
                {(field) => (
                  <Field>
                    <FieldLabel>Host</FieldLabel>
                    <SegmentedControl
                      type="single"
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (isExecutionHostId(value)) field.handleChange(value);
                      }}
                      aria-label="Execution host"
                    >
                      {hosts.map((entry) => (
                        <SegmentedItem key={entry.id} value={entry.id}>
                          {entry.label}
                        </SegmentedItem>
                      ))}
                    </SegmentedControl>
                  </Field>
                )}
              </form.Field>
            ) : null}
            <form.Field
              name="path"
              validators={{
                onChange: requiredTrimmed(
                  "Enter the repository's absolute path on the chosen host.",
                ),
              }}
            >
              {(field) => (
                <>
                  {bridge !== null && hostId === "remote" ? (
                    <Field hint="Git repositories found under the host's home directory.">
                      <FieldLabel>Repository on {labelOf(hostId)}</FieldLabel>
                      <RemoteRepositoryPicker
                        value={field.state.value}
                        onSelect={field.handleChange}
                        enabled={open}
                      />
                    </Field>
                  ) : null}
                  <Field
                    hint="Absolute path of an existing git repository on that host."
                    {...fieldErrorProps(field.state.meta)}
                  >
                    <FieldLabel>Repository path</FieldLabel>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <FieldControl>
                          <Input
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            placeholder={
                              hostId === "local" ? "/Users/you/code/app" : "/home/you/repos/app"
                            }
                            aria-label="Repository path"
                            spellCheck={false}
                            autoFocus
                          />
                        </FieldControl>
                      </div>
                      {bridge !== null && hostId === "local" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void browse()}
                        >
                          Browse…
                        </Button>
                      ) : null}
                    </div>
                  </Field>
                </>
              )}
            </form.Field>
            {error === null ? null : (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <Button type="submit" form="add-project-form" variant="primary" loading={submitting}>
                Add project
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
