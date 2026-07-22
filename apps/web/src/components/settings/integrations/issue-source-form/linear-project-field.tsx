import type { LinearWorkspaceContract } from "@otomat/domain";
import { WHOLE_TEAM } from "@web/components/settings/integrations/issue-source-selection";
import type { FieldMetaLike } from "@web/lib/form";

import { MappingField } from "./mapping-field";

export function LinearProjectField({
  workspace,
  teamId,
  value,
  meta,
  onValueChange,
}: {
  workspace: LinearWorkspaceContract;
  teamId: string;
  value: string;
  meta: FieldMetaLike;
  onValueChange(value: string): void;
}) {
  const options = [
    { value: WHOLE_TEAM, label: "Whole team" },
    ...workspace.projects.flatMap((project) =>
      project.team_ids.includes(teamId) ? [{ value: project.id, label: project.name }] : [],
    ),
  ];

  return (
    <MappingField
      label="Linear project"
      value={value}
      options={options}
      meta={meta}
      onValueChange={onValueChange}
    />
  );
}
