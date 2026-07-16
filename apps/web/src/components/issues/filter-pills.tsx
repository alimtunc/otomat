import { cn } from "@otomat/ui";

export interface FilterPill<V extends string> {
  value: V;
  label: string;
}

export function FilterPills<V extends string>({
  pills,
  value,
  onChange,
  label,
}: {
  pills: FilterPill<V>[];
  value: V;
  onChange: (value: V) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-md border border-border-subtle bg-surface-1 p-0.75"
    >
      {pills.map((pill) => {
        const active = pill.value === value;
        return (
          <button
            key={pill.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(pill.value)}
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-medium text-text-secondary hover:text-foreground",
              "focus-visible:[outline:2px_solid_var(--iris-ring)]",
              active && "bg-surface-3 text-foreground",
            )}
            style={{
              transition:
                "background var(--motion-fast) var(--ease), color var(--motion-fast) var(--ease)",
            }}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
