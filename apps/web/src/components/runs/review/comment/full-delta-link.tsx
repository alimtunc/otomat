import { Button, Icon } from "@otomat/ui";
import { Link } from "@tanstack/react-router";

export function FullDeltaLink({ runId, session }: { runId: string; session: string }) {
  return (
    <Button
      variant="ghost"
      size="xs"
      render={
        <Link to="/runs/$runId/diff" params={{ runId }} search={{ scope: "session", session }}>
          <Icon name="git-compare" aria-hidden />
          View full fix diff
        </Link>
      }
    />
  );
}
