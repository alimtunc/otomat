import type { AgentProfileContract } from "@otomat/domain";
import { Badge, Pill, PillTabs } from "@otomat/ui";

export type ProfileFilter = "all" | "skills" | "instructions";

function isProfileFilter(value: string): value is ProfileFilter {
  return value === "all" || value === "skills" || value === "instructions";
}

export function matchesProfileFilter(
  profile: AgentProfileContract,
  filter: ProfileFilter,
): boolean {
  if (filter === "skills") return profile.skill_ids.length > 0;
  if (filter === "instructions") return Boolean(profile.guidance?.trim());
  return true;
}

export function AgentProfileFilters({
  profiles,
  value,
  onValueChange,
}: {
  profiles: AgentProfileContract[];
  value: ProfileFilter;
  onValueChange: (filter: ProfileFilter) => void;
}) {
  const countFor = (filter: ProfileFilter) =>
    profiles.filter((profile) => matchesProfileFilter(profile, filter)).length;

  return (
    <div className="flex h-10.5 flex-none items-center border-b border-border-subtle px-4.5">
      <PillTabs
        type="single"
        value={value}
        onValueChange={(nextValue) => {
          if (isProfileFilter(nextValue)) onValueChange(nextValue);
        }}
        aria-label="Agent profile filter"
      >
        <Pill value="all" badge={<Badge variant="count">{countFor("all")}</Badge>}>
          All
        </Pill>
        <Pill value="skills" badge={<Badge variant="count">{countFor("skills")}</Badge>}>
          With skills
        </Pill>
        <Pill
          value="instructions"
          badge={<Badge variant="count">{countFor("instructions")}</Badge>}
        >
          With instructions
        </Pill>
      </PillTabs>
    </div>
  );
}
