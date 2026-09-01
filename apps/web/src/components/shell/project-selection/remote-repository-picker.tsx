import { cn } from "@otomat/ui";

import { useRemoteRepositories } from "./use-remote-repositories";

export interface RemoteRepositoryPickerProps {
  value: string;
  onSelect(path: string): void;
  /** False through the dialog's exit transition, where the subtree is still mounted. */
  enabled: boolean;
}

export function RemoteRepositoryPicker({ value, onSelect, enabled }: RemoteRepositoryPickerProps) {
  const { repositories, error } = useRemoteRepositories(enabled);

  if (error !== null) {
    return (
      <p role="alert" className="text-xs text-danger">
        Could not list the host&apos;s repositories: {error}
      </p>
    );
  }
  if (repositories === undefined) {
    return <p className="text-xs text-text-tertiary">Listing repositories on the host…</p>;
  }
  if (repositories.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        No git repository under the host&apos;s home directory; enter a path below.
      </p>
    );
  }

  return (
    <div className="max-h-48 divide-y divide-border-subtle overflow-y-auto rounded-lg border border-border-subtle bg-card">
      {repositories.map((repository) => (
        <button
          key={repository.path}
          type="button"
          onClick={() => onSelect(repository.path)}
          aria-pressed={value === repository.path}
          className={cn(
            "flex w-full items-baseline gap-2 px-3 py-2 text-left transition-colors",
            value === repository.path ? "bg-selected" : "hover:bg-hover",
          )}
        >
          <span className="text-xs text-foreground">{repository.label}</span>
          <span className="truncate font-mono text-micro text-text-tertiary">
            {repository.path}
          </span>
        </button>
      ))}
    </div>
  );
}
