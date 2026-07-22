import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { Chip, Tabs, TabsContent, TabsList, TabsTrigger } from "@otomat/ui";
import { InstructionsPanel } from "@web/components/agents/agent-profile/detail/instructions-panel";
import { AgentProfileRail } from "@web/components/agents/agent-profile/detail/rail";
import { SkillsPanel } from "@web/components/agents/agent-profile/detail/skills-panel";
import { runtimeById } from "@web/lib/runtimes";

export function AgentProfileDetail({
  profile,
  descriptors,
}: {
  profile: AgentProfileContract;
  descriptors: RuntimeDescriptor[];
}) {
  const descriptor = runtimeById(descriptors, profile.runtime);

  return (
    <div className="grid min-h-full grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
      <AgentProfileRail profile={profile} descriptor={descriptor} />
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
            <SkillsPanel profile={profile} descriptor={descriptor} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
