import {
  AGENT_PROFILE_GUIDANCE_MAX_LENGTH,
  type AgentProfileContract,
  type RuntimeDescriptor,
  type SaveAgentProfileRequest,
  type SkillContract,
} from "@otomat/domain";
import {
  AgentAvatar,
  Button,
  Chip,
  EmptyState,
  Field,
  FieldControl,
  FieldLabel,
  Icon,
  MetaList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@otomat/ui";
import { agentProfileErrorMessage, useUpdateAgentProfile } from "@web/api/agent-profiles/mutations";
import { SkillMultiSelect } from "@web/components/agents/skill-multiselect";
import { CAPABILITY_ENTRIES } from "@web/components/settings/runtimes/capability-labels";
import { useState } from "react";

function requestForProfile(
  profile: AgentProfileContract,
  descriptor: RuntimeDescriptor | undefined,
  changes: Partial<Pick<SaveAgentProfileRequest, "guidance" | "skill_ids">>,
): SaveAgentProfileRequest {
  const permissionMode = profile.options.permission_mode;
  const permissionOption = descriptor?.provider_options.find(
    (option) => option.key === "permission_mode",
  );
  const supportsPermissionMode = permissionOption?.choices.some(
    (choice) => choice.value === permissionMode,
  );

  return {
    name: profile.name,
    runtime: profile.runtime,
    options: supportsPermissionMode ? { permission_mode: permissionMode } : {},
    guidance: profile.guidance,
    skill_ids: profile.skill_ids,
    ...changes,
  };
}

function RuntimeAvailability({ descriptor }: { descriptor: RuntimeDescriptor | undefined }) {
  if (!descriptor) return <Chip tone="warning">Runtime not reported</Chip>;
  if (descriptor.availability.status === "available") {
    return <Chip tone="success">Runtime available</Chip>;
  }
  return <Chip tone="warning">Runtime unavailable</Chip>;
}

function RuntimeProperties({
  profile,
  descriptor,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
}) {
  const permissionOption = descriptor?.provider_options.find(
    (option) => option.key === "permission_mode",
  );
  const permissionMode = profile.options.permission_mode;
  const permissionLabel = permissionMode
    ? (permissionOption?.choices.find((choice) => choice.value === permissionMode)?.label ??
      permissionMode)
    : "Runtime default";
  const items = [
    {
      key: "runtime",
      label: "Runtime",
      value: (
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <Icon name="cpu" aria-hidden className="size-3.25 text-text-tertiary" />
          {descriptor?.display_name ?? profile.runtime}
        </span>
      ),
    },
  ];

  if (permissionOption) {
    items.push({
      key: "options",
      label: "Options",
      value: <Chip tone="ghost">{permissionLabel}</Chip>,
    });
  }

  return <MetaList items={items} />;
}

function CapabilitySnapshot({ descriptor }: { descriptor: RuntimeDescriptor | undefined }) {
  if (!descriptor) {
    return (
      <p className="text-xs leading-relaxed text-text-tertiary">
        This runtime is not currently reported, so its capabilities cannot be verified.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.75 text-xs">
      {CAPABILITY_ENTRIES.map(({ key, label }) => {
        const available = descriptor.capabilities[key];
        return (
          <div
            key={key}
            className={
              available
                ? "flex items-center gap-1.75"
                : "flex items-center gap-1.75 text-text-tertiary"
            }
          >
            <Icon
              name={available ? "check" : "x"}
              aria-hidden
              className={available ? "size-3.25 text-success" : "size-3.25"}
            />
            <span>{available ? label : `${label} — unavailable`}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProfileRail({
  profile,
  descriptor,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
}) {
  return (
    <aside className="border-b border-border-subtle bg-sidebar p-4 lg:overflow-auto lg:border-r lg:border-b-0">
      <div className="mb-3.5 flex flex-col items-start gap-2 border-b border-border-subtle pb-3.5">
        <AgentAvatar name={profile.name} size="lg" />
        <h2 className="text-md font-semibold text-foreground">{profile.name}</h2>
        <RuntimeAvailability descriptor={descriptor} />
      </div>

      <section className="mb-2.5 rounded-lg border border-border-subtle bg-card px-3.25 py-3">
        <h3 className="mb-2.5 text-micro font-semibold uppercase tracking-[0.03em] text-text-tertiary">
          Properties
        </h3>
        <RuntimeProperties profile={profile} descriptor={descriptor} />
      </section>

      <section className="rounded-lg border border-border-subtle bg-card px-3.25 py-3">
        <h3 className="mb-2.5 text-micro font-semibold uppercase tracking-[0.03em] text-text-tertiary">
          Capability snapshot <span className="font-normal normal-case">· honest</span>
        </h3>
        <CapabilitySnapshot descriptor={descriptor} />
      </section>
    </aside>
  );
}

function InstructionsPanel({
  profile,
  descriptor,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
}) {
  const update = useUpdateAgentProfile();
  const savedGuidance = profile.guidance ?? "";
  const [guidance, setGuidance] = useState(savedGuidance);
  const [saveError, setSaveError] = useState<string | null>(null);
  const changed = guidance !== savedGuidance;

  async function save() {
    setSaveError(null);
    const normalizedGuidance = guidance.trim() || null;
    try {
      const updated = await update.mutateAsync({
        id: profile.id,
        request: requestForProfile(profile, descriptor, { guidance: normalizedGuidance }),
      });
      setGuidance(updated.guidance ?? "");
      toast.success("Instructions saved");
    } catch (error) {
      setSaveError(agentProfileErrorMessage(error));
    }
  }

  return (
    <div>
      <Field>
        <FieldLabel>Identity &amp; working style</FieldLabel>
        <p className="mb-2 text-xs leading-relaxed text-text-tertiary">
          These instructions are prepended to the agent’s first turn when a run launches.
        </p>
        <FieldControl>
          <Textarea
            aria-label="System guidance"
            className="min-h-50"
            maxLength={AGENT_PROFILE_GUIDANCE_MAX_LENGTH}
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            placeholder="Describe how this profile should approach its work."
          />
        </FieldControl>
      </Field>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="font-mono text-micro text-text-tertiary">
          {guidance.length.toLocaleString()} / {AGENT_PROFILE_GUIDANCE_MAX_LENGTH.toLocaleString()}
        </span>
        <div className="flex-1" />
        {changed ? (
          <Button variant="ghost" size="sm" onClick={() => setGuidance(savedGuidance)}>
            Reset
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          loading={update.isPending}
          disabled={!changed}
          onClick={() => void save()}
        >
          Save changes
        </Button>
      </div>
      {saveError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}

function ActivatedSkillCard({
  skillId,
  skill,
  disabled,
  onRemove,
}: {
  skillId: string;
  skill: SkillContract | undefined;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-card p-3.5">
      <Icon name="book" aria-hidden className="size-3.75 flex-none text-text-tertiary" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {skill?.name ?? skillId}
          </span>
          {skill ? (
            <Chip tone="ghost">{skill.source}</Chip>
          ) : (
            <Chip tone="warning">Unavailable</Chip>
          )}
        </div>
        <p className="truncate text-xs text-text-tertiary">
          {skill?.description ?? "This configured skill is no longer in the catalog."}
        </p>
      </div>
      <Button variant="ghost" size="xs" disabled={disabled} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

function SkillsPanel({
  profile,
  descriptor,
  skills,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
  skills: SkillContract[];
}) {
  const update = useUpdateAgentProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function toggleSkill(skillId: string) {
    if (update.isPending) return;
    setSaveError(null);
    const selected = profile.skill_ids.includes(skillId);
    const skillIds = selected
      ? profile.skill_ids.filter((id) => id !== skillId)
      : [...profile.skill_ids, skillId];
    try {
      await update.mutateAsync({
        id: profile.id,
        request: requestForProfile(profile, descriptor, { skill_ids: skillIds }),
      });
      toast.success(selected ? "Skill removed" : "Skill added");
    } catch (error) {
      setSaveError(agentProfileErrorMessage(error));
    }
  }

  return (
    <div className="flex max-w-180 flex-col gap-4">
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Activated skills</h3>
          <Chip tone="neutral">{profile.skill_ids.length}</Chip>
        </div>
        {profile.skill_ids.length > 0 ? (
          <div className="flex flex-col gap-2">
            {profile.skill_ids.map((skillId) => (
              <ActivatedSkillCard
                key={skillId}
                skillId={skillId}
                skill={skills.find((skill) => skill.id === skillId)}
                disabled={update.isPending}
                onRemove={() => void toggleSkill(skillId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="book"
            variant="compact"
            title="No activated skills"
            description="Choose skills from the catalog below."
            className="rounded-lg border border-border-subtle bg-card"
          />
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Skill catalog</h3>
        <p className="mb-2.5 text-xs leading-relaxed text-text-tertiary">
          Enabled local instructions this profile can activate when a run launches.
        </p>
        <SkillMultiSelect
          skills={skills}
          selectedIds={profile.skill_ids}
          disabled={update.isPending}
          onToggle={(skillId) => void toggleSkill(skillId)}
        />
      </section>

      {saveError ? (
        <p role="alert" className="text-xs text-danger">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}

export function AgentProfileDetail({
  profile,
  descriptors,
  skills,
}: {
  profile: AgentProfileContract;
  descriptors: RuntimeDescriptor[];
  skills: SkillContract[];
}) {
  const descriptor = descriptors.find((runtime) => runtime.id === profile.runtime);

  return (
    <div className="grid min-h-full grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ProfileRail profile={profile} descriptor={descriptor} />
      <div className="min-w-0 lg:overflow-auto">
        <Tabs defaultValue="instructions" className="min-h-full">
          <TabsList className="sticky top-0 z-[3] overflow-x-auto bg-background px-4.5">
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger
              value="skills"
              badge={<Chip tone="neutral">{profile.skill_ids.length}</Chip>}
            >
              Skills
            </TabsTrigger>
          </TabsList>
          <TabsContent value="instructions" className="p-4.5">
            <InstructionsPanel
              key={`${profile.id}:${profile.guidance ?? ""}`}
              profile={profile}
              descriptor={descriptor}
            />
          </TabsContent>
          <TabsContent value="skills" className="p-4.5">
            <SkillsPanel profile={profile} descriptor={descriptor} skills={skills} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
