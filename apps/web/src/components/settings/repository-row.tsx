import type { RepositoryContract } from "@otomat/domain";

export function RepositoryRow({ repository }: { repository: RepositoryContract }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{repository.name}</span>
      <span className="font-mono text-xs text-text-tertiary">{repository.default_branch}</span>
    </li>
  );
}
