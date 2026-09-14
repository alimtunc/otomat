import type { PullRequestCheck } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import { CHECK_SIGNAL } from "@web/lib/pull-request/overview-signals";

export function PullRequestCheckList({ checks }: { checks: PullRequestCheck[] }) {
  return (
    <ul className="mt-2.5 flex flex-col gap-1.5">
      {checks.map((check) => (
        <li
          key={`${check.name}:${check.url ?? ""}`}
          className="flex items-center justify-between gap-2 text-sm"
        >
          {check.url === null ? (
            <span className="min-w-0 break-words">{check.name}</span>
          ) : (
            <a href={check.url} target="_blank" rel="noreferrer" className="min-w-0 break-words">
              {check.name}
            </a>
          )}
          <Chip tone={CHECK_SIGNAL[check.state].tone}>{CHECK_SIGNAL[check.state].label}</Chip>
        </li>
      ))}
    </ul>
  );
}
