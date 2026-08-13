import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { Mono } from "@web/components/issues/workspace/rail/mono";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import { permissionDenials } from "@web/lib/run/permission-denial";
import { permissionDiagnosisText } from "@web/lib/run/permission-diagnosis";

export function PermissionSection() {
  const denials = permissionDenials(useRunEventStream().events);
  if (denials.length === 0) return null;

  return (
    <RailSection title="Refused by the provider">
      {denials.map((denial) => (
        <div key={denial.id} className="mb-3 last:mb-0">
          <RailMeta>
            <RailRow label="Tool">
              <Mono>{denial.tool}</Mono>
            </RailRow>
            <RailRow label="Permission mode">
              {denial.mode === null ? <Unknown /> : <Mono>{denial.mode}</Mono>}
            </RailRow>
          </RailMeta>
          {denial.reason === null ? null : (
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">{denial.reason}</p>
          )}
          {denial.status === null ? null : (
            <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
              {permissionDiagnosisText(denial.status, denial.mode)}
            </p>
          )}
        </div>
      ))}
    </RailSection>
  );
}
