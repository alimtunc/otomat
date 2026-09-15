import type { SourceControlResponse } from "@otomat/domain";
import {
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  Input,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useRepositories } from "@web/api/daemon/queries";
import { RepositoryPullRequestForm } from "@web/components/source-control/repository-pr-form";
import { fieldErrorProps } from "@web/lib/form";
import { useState } from "react";

export interface RepositoryPullRequestDialogProps {
  repositoryId: string;
  changes: SourceControlResponse;
  onClose: () => void;
}

export function RepositoryPullRequestDialog({
  repositoryId,
  changes,
  onClose,
}: RepositoryPullRequestDialogProps) {
  const repositories = useRepositories();
  const base =
    repositories.data?.find((entry) => entry.id === repositoryId)?.default_branch ?? "main";
  const form = useForm({ defaultValues: { base_ref: base } });
  const [busy, setBusy] = useState(false);
  return (
    <DialogContent>
      <DialogHeader className="flex-col items-start gap-2 pr-10">
        <DialogTitle>Publish project commits</DialogTitle>
        <DialogDescription>
          Publish commits from {changes.branch}. Generate the PR or customize its details.
          Uncommitted files stay local.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <form.Field
          name="base_ref"
          validators={{
            onChange: ({ value }) =>
              value.trim() === "" ? "Target branch is required." : undefined,
          }}
        >
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Target branch</FieldLabel>
              <FieldControl>
                <Input
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="main"
                  maxLength={120}
                  disabled={busy}
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.base_ref.trim()}>
          {(baseRef) =>
            baseRef === "" ? null : (
              <RepositoryPullRequestForm
                key={baseRef}
                repositoryId={repositoryId}
                changes={changes}
                baseRef={baseRef}
                onPublished={onClose}
                onBusyChange={setBusy}
              />
            )
          }
        </form.Subscribe>
      </DialogBody>
    </DialogContent>
  );
}
