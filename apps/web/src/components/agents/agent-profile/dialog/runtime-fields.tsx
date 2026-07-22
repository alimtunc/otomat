import type { RuntimeDescriptor } from "@otomat/domain";
import {
  Field,
  FieldControl,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { RuntimeSelect } from "@web/components/runs/launch/runtime-select";
import {
  permissionModeOption,
  runtimeProviderOptions,
  supportedPermissionMode,
  type PermissionModeValue,
} from "@web/lib/agent-choice";

const RUNTIME_DEFAULT_MODE = "__runtime_default";

export function RuntimeFields({
  descriptors,
  runtime,
  permissionMode,
  onRuntimeChange,
  onPermissionModeChange,
}: {
  descriptors: RuntimeDescriptor[];
  runtime: string;
  permissionMode: PermissionModeValue;
  onRuntimeChange: (runtime: string) => void;
  onPermissionModeChange: (permissionMode: PermissionModeValue) => void;
}) {
  const permissionOption = permissionModeOption(runtimeProviderOptions(descriptors, runtime));

  return (
    <>
      <Field>
        <FieldLabel>Runtime</FieldLabel>
        <FieldControl>
          <RuntimeSelect
            descriptors={descriptors}
            value={runtime || null}
            onValueChange={(next) => {
              onRuntimeChange(next);
              onPermissionModeChange(supportedPermissionMode(descriptors, next, permissionMode));
            }}
          />
        </FieldControl>
      </Field>
      {permissionOption ? (
        <Field>
          <FieldLabel>{permissionOption.label}</FieldLabel>
          <FieldControl>
            <Select
              items={[
                { value: RUNTIME_DEFAULT_MODE, label: "Runtime default" },
                ...permissionOption.choices,
              ]}
              value={permissionMode || RUNTIME_DEFAULT_MODE}
              onValueChange={(next) => {
                if (next === null) return;
                onPermissionModeChange(
                  next === RUNTIME_DEFAULT_MODE
                    ? ""
                    : supportedPermissionMode(descriptors, runtime, next),
                );
              }}
            >
              <SelectTrigger aria-label="Permission mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RUNTIME_DEFAULT_MODE}>Runtime default</SelectItem>
                {permissionOption.choices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldControl>
        </Field>
      ) : null}
    </>
  );
}
