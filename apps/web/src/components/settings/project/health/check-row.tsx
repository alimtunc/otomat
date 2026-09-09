import type { ProjectHealthCheck } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import { PROJECT_HEALTH_TONES } from "@web/lib/project-health-tone";

export function HealthCheckRow({ check }: { check: ProjectHealthCheck }) {
  const tone = PROJECT_HEALTH_TONES[check.status];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Chip tone={tone.tone}>{tone.label}</Chip>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm text-foreground">{check.label}</span>
        <span className="text-xs text-text-tertiary">{check.message}</span>
        {check.remediation === null ? null : (
          <span className="text-xs text-text-secondary">{check.remediation}</span>
        )}
      </div>
    </li>
  );
}
