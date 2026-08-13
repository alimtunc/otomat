/** Not a `DropdownMenuLabel`: it names no group, so it must not be announced as one. */
export function MenuNote({ children }: { children: string }) {
  return <p className="px-2 py-1.5 text-xs whitespace-normal text-text-tertiary">{children}</p>;
}
