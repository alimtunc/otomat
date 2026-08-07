import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import {
  Chip,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useMediaQuery,
  usePanelGroupLayout,
  WIDE_VIEWPORT_MEDIA_QUERY,
} from "@otomat/ui";
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
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const railLayout = usePanelGroupLayout("otomat.agent-profile");

  const rail = <AgentProfileRail profile={profile} descriptor={descriptor} />;
  const tabs = (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
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
          <InstructionsPanel key={`${profile.id}:${profile.guidance ?? ""}`} profile={profile} />
        </TabsContent>
        <TabsContent value="skills" className="p-4.5">
          <SkillsPanel profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );

  return wide ? (
    <ResizablePanelGroup {...railLayout} className="h-full min-h-0">
      <SidePanel
        id="agent-profile-rail"
        label="Agent properties"
        side="left"
        defaultSize={280}
        minSize={220}
        maxSize="36%"
      >
        {rail}
      </SidePanel>
      <ResizablePanel id="agent-profile" minSize="40%">
        {tabs}
      </ResizablePanel>
    </ResizablePanelGroup>
  ) : (
    <div className="min-h-full">
      {rail}
      {tabs}
    </div>
  );
}
