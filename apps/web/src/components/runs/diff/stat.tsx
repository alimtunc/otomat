export interface DiffStatProps {
  additions: number;
  deletions: number;
}

export function DiffStat({ additions, deletions }: DiffStatProps) {
  return (
    <>
      <span className="text-success">+{additions}</span>
      <span className="text-danger">-{deletions}</span>
    </>
  );
}
