export function StepBlockedNote({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="text-xs text-warning">
      Blocked — {names.join(", ")} will not run. Cancel this step too, or add a step that replaces
      the canceled one.
    </p>
  );
}
