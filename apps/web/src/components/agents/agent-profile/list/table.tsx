import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { AgentProfileRow } from "@web/components/agents/agent-profile/list/row";
import { HEAD_CELL, TABLE } from "@web/lib/table";

export function AgentProfileList({
  profiles,
  descriptors,
  skills,
  onEdit,
}: {
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  skills: SkillContract[];
  onEdit: (profile: AgentProfileContract) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`${TABLE} min-w-240 table-fixed`}>
        <thead>
          <tr>
            <th className={HEAD_CELL}>Agent</th>
            <th className={`${HEAD_CELL} w-32`}>Runtime</th>
            <th className={`${HEAD_CELL} w-44`}>Availability</th>
            <th className={`${HEAD_CELL} w-14`}>Skills</th>
            <th className={`${HEAD_CELL} w-44`}>Options</th>
            <th className={`${HEAD_CELL} w-16 text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <AgentProfileRow
              key={profile.id}
              profile={profile}
              descriptors={descriptors}
              skills={skills}
              onEdit={onEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
