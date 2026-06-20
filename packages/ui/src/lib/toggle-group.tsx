import { ToggleGroup } from "@base-ui/react/toggle-group";
import type { ComponentPropsWithoutRef } from "react";

type RootProps = ComponentPropsWithoutRef<typeof ToggleGroup>;

export type ToggleGroupRootProps = Omit<
  RootProps,
  "value" | "defaultValue" | "onValueChange" | "multiple"
> &
  (
    | {
        type?: "single";
        value?: string;
        defaultValue?: string;
        onValueChange?: (value: string) => void;
      }
    | {
        type: "multiple";
        value?: string[];
        defaultValue?: string[];
        onValueChange?: (value: string[]) => void;
      }
  );

function toArrayValue(
  value: string | string[] | undefined,
  multiple: boolean,
): string[] | undefined {
  if (value === undefined) return undefined;
  return multiple ? (value as string[]) : [value as string];
}

export function ToggleGroupRoot({ className, children, ...props }: ToggleGroupRootProps) {
  const { type = "single", value, defaultValue, onValueChange, ...rest } = props;
  const multiple = type === "multiple";

  const groupValue = toArrayValue(value, multiple);
  const groupDefaultValue = toArrayValue(defaultValue, multiple);

  const handleValueChange = onValueChange
    ? (next: string[]) =>
        multiple
          ? (onValueChange as (v: string[]) => void)(next)
          : (onValueChange as (v: string) => void)(next[0] ?? "")
    : undefined;

  return (
    <ToggleGroup
      multiple={multiple}
      value={groupValue}
      defaultValue={groupDefaultValue}
      onValueChange={handleValueChange}
      className={className}
      {...rest}
    >
      {children}
    </ToggleGroup>
  );
}
