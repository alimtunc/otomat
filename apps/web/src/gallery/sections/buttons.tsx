import { Button, Icon, IconButton, Kbd } from "@otomat/ui";

import { Row, Section } from "../section";

export function ButtonsSection() {
  return (
    <Section title="Buttons">
      <Row>
        <Button variant="primary">
          <Icon name="play" />
          Launch run
        </Button>
        <Button>Secondary</Button>
        <Button variant="light">Confirm</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
        <Button size="sm">Small</Button>
        <Button size="xs">Extra small</Button>
        <Button variant="primary" loading style={{ width: 96 }}>
          Loading
        </Button>
        <IconButton label="Icon button" icon={<Icon name="settings" />} />
        <Kbd>⌘K</Kbd>
      </Row>
    </Section>
  );
}
