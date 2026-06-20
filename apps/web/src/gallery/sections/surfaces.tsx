import { SURFACE_SWATCHES } from "../gallery.fixtures";
import { Section } from "../section";

export function SurfacesSection() {
  return (
    <Section title="Surfaces & accent">
      <div className="flex flex-wrap gap-2">
        {SURFACE_SWATCHES.map((sw) => (
          <div key={sw.varName} className="flex items-center gap-2">
            <div
              className="size-9 rounded-md border border-border-subtle"
              style={{ background: `var(${sw.varName})` }}
            />
            <div className="text-xs leading-tight text-text-secondary">
              {sw.varName.replace("--", "")}
              <br />
              <span className="font-mono text-text-tertiary">{sw.hex}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
