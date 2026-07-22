import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { ErrorState } from "@otomat/ui";
import { useSkills } from "@web/api/skills/queries";
import { SkillsPanelContent } from "@web/components/agents/agent-profile/detail/skills-panel-content";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function SkillsPanel({
  profile,
  descriptor,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
}) {
  const skills = useSkills();

  return (
    <QueryBoundary
      query={skills}
      pending={<ListSkeleton rows={3} height={40} />}
      error={
        <ErrorState
          variant="compact"
          title="Couldn’t load the skill catalog"
          onRetry={() => void skills.refetch()}
        />
      }
    >
      {(catalog) => (
        <SkillsPanelContent profile={profile} descriptor={descriptor} skills={catalog} />
      )}
    </QueryBoundary>
  );
}
