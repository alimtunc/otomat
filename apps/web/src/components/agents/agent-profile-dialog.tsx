import {
  AGENT_PROFILE_GUIDANCE_MAX_LENGTH,
  CLAUDE_PERMISSION_MODES,
  type AgentProfileContract,
  type ClaudePermissionMode,
  type RuntimeDescriptor,
  type SaveAgentProfileRequest,
  type SkillContract,
} from "@otomat/domain";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
  toast,
  ErrorState,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  agentProfileErrorMessage,
  useCreateAgentProfile,
  useUpdateAgentProfile,
} from "@web/api/agent-profiles/mutations";
import { useRuntimes } from "@web/api/daemon/queries";
import { useSkills } from "@web/api/skills/queries";
import { SkillMultiSelect } from "@web/components/agents/skill-multiselect";
import { RuntimeSelect } from "@web/components/runs/launch/runtime-select";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { runtimeProviderOptions } from "@web/lib/agent-choice";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { useState } from "react";

const RUNTIME_DEFAULT_MODE = "__runtime_default";

type PermissionModeValue = ClaudePermissionMode | "";

function isClaudePermissionMode(value: string): value is ClaudePermissionMode {
  return CLAUDE_PERMISSION_MODES.some((mode) => mode === value);
}

function supportedPermissionMode(
  descriptors: RuntimeDescriptor[],
  runtime: string,
  value: string | undefined,
): PermissionModeValue {
  if (!value || !isClaudePermissionMode(value)) return "";
  const permissionOption = runtimeProviderOptions(descriptors, runtime).find(
    (option) => option.key === "permission_mode",
  );
  return permissionOption?.choices.some((choice) => choice.value === value) ? value : "";
}

export interface AgentProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: AgentProfileContract | null;
}

function RuntimeFields({
  descriptors,
  runtime,
  permissionMode,
  onRuntimeChange,
  onPermissionModeChange,
}: {
  descriptors: RuntimeDescriptor[];
  runtime: string;
  permissionMode: PermissionModeValue;
  onRuntimeChange: (runtime: string) => void;
  onPermissionModeChange: (permissionMode: PermissionModeValue) => void;
}) {
  const permissionOption = runtimeProviderOptions(descriptors, runtime).find(
    (option) => option.key === "permission_mode",
  );

  return (
    <>
      <Field>
        <FieldLabel>Runtime</FieldLabel>
        <FieldControl>
          <RuntimeSelect
            descriptors={descriptors}
            value={runtime || null}
            onValueChange={(next) => {
              onRuntimeChange(next);
              onPermissionModeChange(supportedPermissionMode(descriptors, next, permissionMode));
            }}
          />
        </FieldControl>
      </Field>

      {permissionOption ? (
        <Field>
          <FieldLabel>{permissionOption.label}</FieldLabel>
          <FieldControl>
            <Select
              items={[
                { value: RUNTIME_DEFAULT_MODE, label: "Runtime default" },
                ...permissionOption.choices,
              ]}
              value={permissionMode || RUNTIME_DEFAULT_MODE}
              onValueChange={(next) => {
                if (next === null) return;
                onPermissionModeChange(
                  next === RUNTIME_DEFAULT_MODE
                    ? ""
                    : supportedPermissionMode(descriptors, runtime, next),
                );
              }}
            >
              <SelectTrigger aria-label="Permission mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RUNTIME_DEFAULT_MODE}>Runtime default</SelectItem>
                {permissionOption.choices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldControl>
        </Field>
      ) : null}
    </>
  );
}

function SkillsField({
  skills,
  selectedIds,
  onChange,
}: {
  skills: SkillContract[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}) {
  return (
    <Field>
      <FieldLabel>Skills</FieldLabel>
      <SkillMultiSelect
        skills={skills}
        selectedIds={selectedIds}
        onToggle={(id) => {
          onChange(
            selectedIds.includes(id)
              ? selectedIds.filter((entry) => entry !== id)
              : [...selectedIds, id],
          );
        }}
      />
    </Field>
  );
}

function AgentProfileForm({
  profile,
  descriptors,
  skills,
  onSaved,
  onCancel,
}: {
  profile: AgentProfileContract | null;
  descriptors: RuntimeDescriptor[];
  skills: SkillContract[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const create = useCreateAgentProfile();
  const update = useUpdateAgentProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstRuntime = descriptors.find(
    (descriptor) => descriptor.availability.status === "available",
  );
  const form = useForm({
    defaultValues: {
      name: profile?.name ?? "",
      runtime: profile?.runtime ?? firstRuntime?.id ?? "",
      permissionMode: supportedPermissionMode(
        descriptors,
        profile?.runtime ?? firstRuntime?.id ?? "",
        profile?.options.permission_mode,
      ),
      guidance: profile?.guidance ?? "",
      skillIds: profile?.skill_ids ?? [],
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const permissionMode = supportedPermissionMode(
        descriptors,
        value.runtime,
        value.permissionMode,
      );
      const request: SaveAgentProfileRequest = {
        name: value.name.trim(),
        runtime: value.runtime,
        options: permissionMode ? { permission_mode: permissionMode } : {},
        guidance: value.guidance.trim() ? value.guidance.trim() : null,
        skill_ids: value.skillIds,
      };
      try {
        if (profile) await update.mutateAsync({ id: profile.id, request });
        else await create.mutateAsync(request);
        toast.success(profile ? "Profile updated" : "Profile created");
        form.reset();
        onSaved();
      } catch (error) {
        setSubmitError(agentProfileErrorMessage(error));
      }
    },
  });

  const isPending = create.isPending || update.isPending;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DialogBody className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <form.Field
          name="name"
          validators={{ onChange: requiredTrimmed("Give the profile a name.") }}
        >
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Name</FieldLabel>
              <FieldControl>
                <Input
                  autoFocus
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="e.g. Careful reviewer"
                  aria-label="Profile name"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <>
              <RuntimeFields
                descriptors={descriptors}
                runtime={values.runtime}
                permissionMode={values.permissionMode}
                onRuntimeChange={(runtime) => form.setFieldValue("runtime", runtime)}
                onPermissionModeChange={(permissionMode) =>
                  form.setFieldValue("permissionMode", permissionMode)
                }
              />
              <SkillsField
                skills={skills}
                selectedIds={values.skillIds}
                onChange={(skillIds) => form.setFieldValue("skillIds", skillIds)}
              />
            </>
          )}
        </form.Subscribe>

        <form.Field name="guidance">
          {(field) => (
            <Field>
              <FieldLabel>System guidance</FieldLabel>
              <FieldControl>
                <Textarea
                  rows={4}
                  maxLength={AGENT_PROFILE_GUIDANCE_MAX_LENGTH}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Instructions prepended to the agent's first turn (optional)."
                  aria-label="System guidance"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>

        {submitError === null ? null : (
          <p role="alert" className="text-xs text-danger">
            {submitError}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <form.Subscribe selector={(state) => [state.values.name, state.values.runtime] as const}>
          {([name, runtime]) => (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isPending}
              disabled={name.trim().length === 0 || runtime.length === 0 || isPending}
            >
              {profile ? "Save changes" : "Create profile"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

function DialogLoading() {
  return (
    <DialogBody>
      <div role="status" aria-label="Loading agent profile form" className="flex flex-col gap-3">
        <Skeleton width="35%" height={14} />
        <Skeleton width="100%" height={32} />
        <Skeleton width="28%" height={14} />
        <Skeleton width="100%" height={32} />
        <Skeleton width="100%" height={96} />
      </div>
    </DialogBody>
  );
}

export function AgentProfileDialog({ open, onOpenChange, profile }: AgentProfileDialogProps) {
  const runtimes = useRuntimes();
  const skills = useSkills();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={profile ? "Edit agent profile" : "New agent profile"}
        className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>{profile ? "Edit agent profile" : "New agent profile"}</DialogTitle>
        </DialogHeader>
        <QueryBoundary
          query={runtimes}
          pending={<DialogLoading />}
          error={
            <DialogBody>
              <ErrorState
                variant="compact"
                title="Couldn’t load runtimes"
                onRetry={() => void runtimes.refetch()}
              />
            </DialogBody>
          }
        >
          {(descriptors) => (
            <QueryBoundary
              query={skills}
              pending={<DialogLoading />}
              error={
                <DialogBody>
                  <ErrorState
                    variant="compact"
                    title="Couldn’t load the skill catalog"
                    onRetry={() => void skills.refetch()}
                  />
                </DialogBody>
              }
            >
              {(skillCatalog) => (
                <AgentProfileForm
                  profile={profile}
                  descriptors={descriptors}
                  skills={skillCatalog}
                  onSaved={() => onOpenChange(false)}
                  onCancel={() => onOpenChange(false)}
                />
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}
