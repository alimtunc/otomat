import type { RuntimeDescriptor } from "@otomat/domain";
import { Field, FieldControl, FieldLabel } from "@otomat/ui";
import { RuntimeSelect } from "@web/components/runs/launch/runtime-select";

export function RuntimeFields({
  descriptors,
  runtime,
  onRuntimeChange,
}: {
  descriptors: RuntimeDescriptor[];
  runtime: string;
  onRuntimeChange: (runtime: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>Runtime</FieldLabel>
      <FieldControl>
        <RuntimeSelect
          descriptors={descriptors}
          value={runtime || null}
          onValueChange={onRuntimeChange}
        />
      </FieldControl>
    </Field>
  );
}
