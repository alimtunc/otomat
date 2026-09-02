import type { PullRequestCheck } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import { CHECK_SIGNAL } from "@web/lib/pull-request/overview-signals";

export function PullRequestChecks({ checks }: { checks: PullRequestCheck[] }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <h3 className="text-xs font-semibold text-text-secondary">Checks</h3>
      {checks.length === 0 ? (
        <p className="mt-2 text-sm text-text-tertiary">No check ran on this head.</p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {checks.map((check) => (
            <li key={check.name} className="flex items-center justify-between gap-2 text-sm">
              {check.url === null ? (
                <span className="truncate">{check.name}</span>
              ) : (
                <a href={check.url} target="_blank" rel="noreferrer" className="truncate">
                  {check.name}
                </a>
              )}
              <Chip tone={CHECK_SIGNAL[check.state].tone}>{CHECK_SIGNAL[check.state].label}</Chip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
