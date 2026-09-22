export function DependencyNote({
  names,
  parallel = false,
  className,
}: {
  names: string[];
  parallel?: boolean;
  className: string;
}) {
  if (parallel) return <p className={className}>in parallel — shares the workspace</p>;
  if (names.length === 0) return null;
  return <p className={className}>after {names.join(", ")}</p>;
}
