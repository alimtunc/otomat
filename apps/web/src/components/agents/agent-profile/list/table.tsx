import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { AgentProfileRow } from "@web/components/agents/agent-profile/list/row";
import { HEAD_CELL, TABLE } from "@web/lib/table";

export function AgentProfileList({
  profiles,
  descriptors,
  onEdit,
}: {
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  onEdit: (profile: AgentProfileContract) => void;
}) {
  return (
    <table className={TABLE}>
      <thead>
        <tr>
          <th className={HEAD_CELL}>Agent</th>
          <th className={`${HEAD_CELL} w-40`}>Runtime</th>
          <th className={`${HEAD_CELL} w-24`}>Skills</th>
          <th className={`${HEAD_CELL} w-40`}>Options</th>
          <th className={`${HEAD_CELL} w-24 text-right`}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {profiles.map((profile) => (
          <AgentProfileRow
            key={profile.id}
            profile={profile}
            descriptors={descriptors}
            onEdit={onEdit}
          />
        ))}
      </tbody>
    </table>
  );
}
