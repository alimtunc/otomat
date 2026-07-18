import { PlaceholderView } from "@web/components/shell/placeholder-view";

export function AgentsView() {
  return (
    <PlaceholderView
      active="agents"
      icon="bot"
      label="Agents"
      titleNote="AI teammates that pick up runs from issues."
      title="Agent catalog"
      description="Name, purpose, default runtime preference, prompt profile, allowed capabilities. The daemon does not expose an agent registry yet — runtime adapters live in Settings → Runtimes."
      action={{ label: "New agent", disabledReason: "Agent catalog is not wired up yet" }}
    />
  );
}
