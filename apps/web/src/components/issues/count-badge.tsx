import { Badge } from "@otomat/ui";

export function CountBadge({ count, tone }: { count: number; tone: "accent" | "neutral" }) {
  return (
    <Badge variant="count" className={tone === "accent" ? "bg-iris-solid text-white" : undefined}>
      {count}
    </Badge>
  );
}
