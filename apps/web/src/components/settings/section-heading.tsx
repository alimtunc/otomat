export function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5 flex flex-col gap-1">
      <h1 className="text-md font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-text-tertiary">{description}</p>
    </div>
  );
}
