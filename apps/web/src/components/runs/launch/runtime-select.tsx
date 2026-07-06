import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";

export function RuntimeSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const runtimes = useRuntimes();
  const items = (runtimes.data ?? []).map((descriptor) => ({
    value: descriptor.id,
    label: descriptor.display_name,
  }));

  return (
    <>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next);
        }}
      >
        <SelectTrigger aria-label="Runtime" disabled={runtimes.isPending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {runtimes.isError ? (
        <p className="text-xs text-danger">
          Couldn’t load the daemon’s runtime list — only the default runtime is available.
        </p>
      ) : null}
    </>
  );
}
