import { Chip, PROVENANCE_LABEL, PROVENANCE_VAR } from "@otomat/ui";

import { PROVENANCE_SOURCES } from "../gallery.fixtures";
import { Row } from "../row";
import { Section } from "../section";

export function ProvenanceSection() {
  return (
    <Section title="Provenance accents (event source · 1px-bordered dot, never full fill)">
      <Row>
        {PROVENANCE_SOURCES.map((source) => (
          <Chip key={source} tone="ghost">
            <span
              aria-hidden
              className="size-1.5 flex-none rounded-full"
              style={{
                background: PROVENANCE_VAR[source],
                boxShadow: "0 0 0 1px var(--ring-contrast)",
              }}
            />
            {PROVENANCE_LABEL[source]}
          </Chip>
        ))}
      </Row>
    </Section>
  );
}
