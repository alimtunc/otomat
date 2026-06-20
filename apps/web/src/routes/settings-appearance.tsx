import { Button, SegmentedControl, SegmentedItem, useTheme } from "@otomat/ui";
import type { Density, Direction, Theme } from "@otomat/ui";
import { Moon, Palette, Rows3, Rows4, Sun } from "lucide-react";
import type { ReactNode } from "react";

function Row({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border-subtle py-4 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-text-tertiary">{description}</span>
      </div>
      <div className="flex-none">{control}</div>
    </div>
  );
}

const DEFAULT_ACCENT = "#5B7CFA";

export function AppearanceSection() {
  const { theme, density, direction, accent, setTheme, setDensity, setDirection, setAccent } =
    useTheme();

  return (
    <div>
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-md font-semibold text-foreground">Appearance</h1>
        <p className="text-sm text-text-tertiary">
          Local interface preferences. Stored on this device only.
        </p>
      </div>

      <div className="rounded-lg border border-border-subtle bg-card px-4">
        <Row
          label="Theme"
          description="Dark is the default surface."
          control={
            <SegmentedControl
              type="single"
              value={theme}
              onValueChange={(v) => v && setTheme(v as Theme)}
              aria-label="Theme"
            >
              <SegmentedItem value="dark" icon={<Moon />}>
                Dark
              </SegmentedItem>
              <SegmentedItem value="light" icon={<Sun />}>
                Light
              </SegmentedItem>
            </SegmentedControl>
          }
        />

        <Row
          label="Density"
          description="Controls row heights and spacing."
          control={
            <SegmentedControl
              type="single"
              value={density}
              onValueChange={(v) => v && setDensity(v as Density)}
              aria-label="Density"
            >
              <SegmentedItem value="compact" icon={<Rows4 />}>
                Compact
              </SegmentedItem>
              <SegmentedItem value="comfortable" icon={<Rows3 />}>
                Comfortable
              </SegmentedItem>
            </SegmentedControl>
          }
        />

        <Row
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

        <Row
          label="Custom accent"
          description="Override the direction palette with a single base color."
          control={
            <div className="flex items-center gap-2">
              <label
                className="relative inline-flex h-6.5 w-6.5 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border"
                style={{ background: accent ?? "var(--iris-solid)" }}
              >
                <Palette className="h-3 w-3 text-white mix-blend-difference" aria-hidden />
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
