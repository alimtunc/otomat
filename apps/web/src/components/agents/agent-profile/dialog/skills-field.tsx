import type { SkillContract } from "@otomat/domain";
import { Field, FieldLabel } from "@otomat/ui";
import { SkillMultiSelect } from "@web/components/agents/agent-profile/shared/skill-multi-select";

export function SkillsField({
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
