import { Avatar, AgentAvatar, Button, LiveDot, Spinner, toast } from "@otomat/ui";

import { Row } from "../row";
import { Section } from "../section";

export function AvatarsSection() {
  return (
    <Section title="Avatars · live · feedback">
      <Row>
        <Avatar name="Alim Tunc" color="#E0457B" />
        <AgentAvatar name="Agent" />
        <AgentAvatar name="claude" active runtimeTint="var(--prov-claude)" />
        <AgentAvatar name="codex" runtimeTint="var(--prov-codex)" />
        <LiveDot tone="success" live />
        <Spinner />
        <Button size="sm" onClick={() => toast("Custom arguments saved")}>
          Show toast
        </Button>
        <Button size="sm" onClick={() => toast.error("Diff unavailable — retry")}>
          Error toast
        </Button>
      </Row>
    </Section>
  );
}
