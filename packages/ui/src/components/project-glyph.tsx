export function ProjectGlyph({ name }: { name: string }) {
  return (
    <div
      className="grid h-6 w-6 flex-none place-items-center rounded-md text-[13px] font-bold text-on-accent"
      style={{ background: "linear-gradient(160deg,var(--iris-hover),var(--iris-active))" }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
