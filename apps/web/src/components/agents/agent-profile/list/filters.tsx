import type { AgentProfileContract } from "@otomat/domain";
import { Badge, Pill, PillTabs } from "@otomat/ui";

import { isProfileFilter, matchesProfileFilter, type ProfileFilter } from "./profile-filter";

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
