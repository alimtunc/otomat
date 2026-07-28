export function DependencyNote({ names, className }: { names: string[]; className: string }) {
  if (names.length === 0) return null;
  return <p className={className}>after {names.join(", ")}</p>;
}
