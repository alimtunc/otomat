import { Spinner, Wordmark } from "@otomat/ui";
import { desktopBridge } from "@web/lib/desktop-bridge";

export function StartupScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background text-foreground">
      <Wordmark enter={desktopBridge() === null} />
      <Spinner motion="breathe" size={22} className="text-sm text-text-secondary">
        Opening your workspace…
      </Spinner>
    </main>
  );
}
