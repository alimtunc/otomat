import { Button, Icon, SegmentedControl, SegmentedItem, useTheme, type Accent } from "@otomat/ui";

import { ACCENT_SWATCHES } from "./gallery.fixtures";

const ACCENTS: { value: Accent; label: string }[] = [
  { value: "iris", label: "Iris" },
  { value: "brass", label: "Brass" },
  { value: "viridian", label: "Viridian" },
];

export function Switcher() {
  const {
    theme,
    density,
    accent,
    customAccent,
    toggleTheme,
    setDensity,
    setAccent,
    setCustomAccent,
  } = useTheme();

  return (
    <div className="sticky top-0 z-10 -mx-6 mb-2 flex flex-wrap items-center gap-4 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
      <Button size="sm" onClick={toggleTheme}>
        {theme === "dark" ? <Icon name="moon-star" /> : <Icon name="sun" />}
        {theme === "dark" ? "Dark" : "Light"}
      </Button>

      <SegmentedControl
        type="single"
        value={accent}
        onValueChange={(value) => value && setAccent(value as Accent)}
        aria-label="Accent direction"
      >
        {ACCENTS.map((d) => (
          <SegmentedItem key={d.value} value={d.value}>
            {d.label}
          </SegmentedItem>
        ))}
      </SegmentedControl>

      <SegmentedControl
        type="single"
        value={density}
        onValueChange={(value) => value && setDensity(value as "compact" | "comfortable")}
        aria-label="Density"
      >
        <SegmentedItem value="compact" icon={<Icon name="rows-3" />}>
          Compact
        </SegmentedItem>
        <SegmentedItem value="comfortable" icon={<Icon name="monitor" />}>
          Comfortable
        </SegmentedItem>
      </SegmentedControl>

      <div className="flex items-center gap-2">
        <span className="text-xs text-text-tertiary">Accent</span>
        {ACCENT_SWATCHES.map((sw) => (
          <button
            key={sw.hex}
            type="button"
            onClick={() => setCustomAccent(sw.hex)}
            aria-label={`Accent ${sw.label}`}
            title={sw.label}
            className="size-5 rounded-full border"
            style={{
              backgroundColor: sw.hex,
              borderColor:
                customAccent?.toLowerCase() === sw.hex.toLowerCase()
                  ? "var(--foreground)"
                  : "var(--border)",
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => setCustomAccent(null)}
          className="text-xs text-text-tertiary hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
