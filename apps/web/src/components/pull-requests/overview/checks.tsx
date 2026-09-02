import type { PullRequestCheck } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import { OverviewSection } from "@web/components/pull-requests/overview/section";
import { CHECK_SIGNAL } from "@web/lib/pull-request/overview-signals";

export function PullRequestChecks({ checks }: { checks: PullRequestCheck[] }) {
  return (
    <OverviewSection title="Checks">
      {checks.length === 0 ? (
        <p className="mt-2 text-sm text-text-tertiary">No check ran on this head.</p>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {checks.map((check) => (
            <li
              key={`${check.name}:${check.url ?? ""}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
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
    </OverviewSection>
  );
}
