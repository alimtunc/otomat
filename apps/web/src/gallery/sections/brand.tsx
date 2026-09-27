import { Button, Spinner, Wordmark } from "@otomat/ui";

import { Row } from "../row";
import { Section } from "../section";

export function BrandSection() {
  return (
    <Section title="Otomat · brand & loading">
      <Row>
        <Wordmark enter />
      </Row>
      <Row>
        <Spinner motion="breathe" size={28}>
          Opening your workspace…
        </Spinner>
        <Spinner label="Syncing issues" />
        <Spinner motion="breathe" size={14}>
          Loading activity…
        </Spinner>
        <Button loading aria-label="Syncing with Linear">
          Sync
        </Button>
      </Row>
    </Section>
  );
}
