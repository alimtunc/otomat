import { Button, Icon, SegmentedControl, SegmentedItem, useTheme } from "@otomat/ui";
import type { Density, Direction, Theme } from "@otomat/ui";
import { AppearanceRow } from "@web/components/settings/appearance-row";
import { DEFAULT_ACCENT } from "@web/components/settings/appearance-section.constants";
import { SectionHeading } from "@web/components/settings/section-heading";

export function AppearanceSection() {
  const { theme, density, direction, accent, setTheme, setDensity, setDirection, setAccent } =
    useTheme();

  return (
    <div>
      <SectionHeading
        title="Appearance"
        description="Local interface preferences. Stored on this device only."
      />

      <div className="rounded-lg border border-border-subtle bg-card px-4">
        <AppearanceRow
          label="Theme"
          description="Dark is the default surface."
          control={
            <SegmentedControl
              type="single"
              value={theme}
              onValueChange={(v) => v && setTheme(v as Theme)}
              aria-label="Theme"
            >
              <SegmentedItem value="dark" icon={<Icon name="moon" />}>
                Dark
              </SegmentedItem>
              <SegmentedItem value="light" icon={<Icon name="sun" />}>
                Light
              </SegmentedItem>
            </SegmentedControl>
          }
        />

        <AppearanceRow
          label="Density"
          description="Controls row heights and spacing."
          control={
            <SegmentedControl
              type="single"
              value={density}
              onValueChange={(v) => v && setDensity(v as Density)}
              aria-label="Density"
            >
              <SegmentedItem value="compact" icon={<Icon name="rows-4" />}>
                Compact
              </SegmentedItem>
              <SegmentedItem value="comfortable" icon={<Icon name="rows-3" />}>
                Comfortable
              </SegmentedItem>
            </SegmentedControl>
          }
        />

        <AppearanceRow
          label="Accent direction"
          description="Built-in accent palettes. Selecting one clears any custom accent."
          control={
            <SegmentedControl
              type="single"
              value={direction}
              onValueChange={(v) => v && setDirection(v as Direction)}
              aria-label="Accent direction"
            >
              <SegmentedItem value="iris">Iris</SegmentedItem>
              <SegmentedItem value="brass">Brass</SegmentedItem>
              <SegmentedItem value="viridian">Viridian</SegmentedItem>
            </SegmentedControl>
          }
        />

        <AppearanceRow
          label="Custom accent"
          description="Override the direction palette with a single base color."
          control={
            <div className="flex items-center gap-2">
              <label
                className="relative inline-flex h-6.5 w-6.5 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border"
                style={{ background: accent ?? "var(--iris-solid)" }}
              >
                <Icon
                  name="palette"
                  className="h-3 w-3 text-white mix-blend-difference"
                  aria-hidden
                />
                <input
                  type="color"
                  aria-label="Custom accent color"
                  value={accent ?? DEFAULT_ACCENT}
                  onChange={(e) => setAccent(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAccent(null)}
                disabled={accent == null}
              >
                Reset
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
