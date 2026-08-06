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
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";
import {
  registerRepositoryErrorMessage,
  useRegisterRepository,
} from "@web/api/repositories/mutations";
import { projectSwitcherKey } from "@web/components/shell/project-selection/host-key";
import { RemoteRepositoryPicker } from "@web/components/shell/project-selection/remote-repository-picker";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { useState } from "react";

export interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hosts: Array<{ id: ExecutionHostId; label: string; active: boolean }>;
  /** Receives the new project's switcher key; the caller owns selection (and the cross-host switch). */
  onSelect: (switcherId: string) => void;
}

export function AddProjectDialog({ open, onOpenChange, hosts, onSelect }: AddProjectDialogProps) {
  const bridge = desktopBridge();
  const client = useQueryClient();
  const browserRegister = useRegisterRepository();
  const [hostChoice, setHostChoice] = useState<ExecutionHostId | null>(null);
  const [path, setPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeHostId = hosts.find((entry) => entry.active)?.id ?? "local";
  const hostId = hostChoice ?? activeHostId;
  const hostLabel = hosts.find((entry) => entry.id === hostId)?.label ?? "Local";
  const multiHost = bridge !== null && hosts.length > 1;

  function close(): void {
    setPath("");
    setError(null);
    setHostChoice(null);
    onOpenChange(false);
  }

  function registered(projectId: string, name: string): void {
    void client.invalidateQueries({ queryKey: ["execution-host", "projects"] });
    void client.invalidateQueries({ queryKey: queryKeys.projects });
    void client.invalidateQueries({ queryKey: queryKeys.repositories });
    toast.success(`${name} added on ${hostLabel}`);
    close();
    onSelect(projectSwitcherKey(hostId, projectId));
  }

  async function submit(): Promise<void> {
    setError(null);
    const trimmed = path.trim();
    if (trimmed === "") {
      setError("Enter the repository's absolute path on the chosen host.");
      return;
    }
    setSubmitting(true);
    try {
      if (bridge !== null) {
        const result = await bridge.executionHost.registerProject(hostId, trimmed);
        if (result.ok) registered(result.project.id, result.project.name);
        else setError(result.message);
        return;
      }
      const response = await browserRegister.mutateAsync({ path: trimmed });
      registered(response.project.id, response.project.name);
    } catch (submitError) {
      setError(registerRepositoryErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function browse(): Promise<void> {
    if (bridge === null) return;
    const picked = await bridge.pickDirectory();
    if (picked !== null) setPath(picked);
  }

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
              void submit();
            }}
          >
            {multiHost ? (
              <Field>
                <FieldLabel>Host</FieldLabel>
                <SegmentedControl
                  type="single"
                  value={hostId}
                  onValueChange={(value) => {
                    if (isExecutionHostId(value)) setHostChoice(value);
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
            ) : null}
            {bridge !== null && hostId === "remote" ? (
              <Field hint="Git repositories found under the host's home directory.">
                <FieldLabel>Repository on {hostLabel}</FieldLabel>
                <RemoteRepositoryPicker value={path} onSelect={setPath} enabled={open} />
              </Field>
            ) : null}
            <Field hint="Absolute path of an existing git repository on that host.">
              <FieldLabel>Repository path</FieldLabel>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <FieldControl>
                    <Input
                      value={path}
                      onChange={(event) => setPath(event.target.value)}
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
                  <Button type="button" variant="outline" size="sm" onClick={() => void browse()}>
                    Browse…
                  </Button>
                ) : null}
              </div>
            </Field>
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
          <Button type="submit" form="add-project-form" variant="primary" loading={submitting}>
            Add project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
