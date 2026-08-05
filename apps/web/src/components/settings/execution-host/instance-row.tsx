import type { RemoteInstanceEntry } from "@otomat/domain";
import { Button } from "@otomat/ui";

export interface InstanceRowProps {
  instance: RemoteInstanceEntry;
  /** Label of the in-flight action, or null; every button disables while one is pending. */
  pending: string | null;
  onStop(build: string): void;
  onRemove(build: string): void;
}

export function InstanceRow({ instance, pending, onStop, onRemove }: InstanceRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <code className="text-xs text-foreground">{instance.build}</code>
      <span className="text-xs text-text-tertiary">
        {instance.running ? `running · port ${instance.port}` : "stopped"}
      </span>
      <span className="text-xs text-text-tertiary">
        {Math.max(1, Math.round(instance.size_kb / 1024))} MB
      </span>
      <span className="flex-1" />
      {instance.running ? (
        <Button
          variant="outline"
          onClick={() => onStop(instance.build)}
          disabled={pending !== null}
        >
          {pending === `stop:${instance.build}` ? "Stopping…" : "Stop"}
        </Button>
      ) : null}
      <Button
        variant="destructive"
        onClick={() => onRemove(instance.build)}
        disabled={pending !== null}
      >
        {pending === `delete:${instance.build}` ? "Deleting…" : "Delete"}
      </Button>
    </div>
  );
}
