import { DialogBody, Skeleton } from "@otomat/ui";

export function AgentProfileDialogLoading() {
  return (
    <DialogBody>
      <div role="status" aria-label="Loading agent profile form" className="flex flex-col gap-3">
        <Skeleton width="35%" height={14} />
        <Skeleton width="100%" height={32} />
        <Skeleton width="28%" height={14} />
        <Skeleton width="100%" height={32} />
        <Skeleton width="100%" height={96} />
      </div>
    </DialogBody>
  );
}
