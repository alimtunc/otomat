import { Button, type ButtonProps } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import type { NextActionCta } from "@web/lib/run/next-action";
import type { ReactElement } from "react";

export interface NextActionCtaButtonProps {
  runId: string;
  cta: NextActionCta;
  size: ButtonProps["size"];
  className?: string;
}

export function NextActionCtaButton({ runId, cta, size, className }: NextActionCtaButtonProps) {
  const target = cta.target;
  const link = (): ReactElement => {
    switch (target.type) {
      case "external":
        return <a href={target.url} target="_blank" rel="noreferrer" aria-label={cta.label} />;
      case "diff":
        return <Link to="/runs/$runId/diff" params={{ runId }} />;
      case "pr":
        return <Link to="/runs/$runId/pr" params={{ runId }} />;
      case "conversation":
        return (
          <Link
            to="/runs/$runId"
            params={{ runId }}
            search={target.stepId === undefined ? undefined : { step: target.stepId }}
          />
        );
    }
  };
  return (
    <Button size={size} className={className} render={link()}>
      {cta.label}
    </Button>
  );
}
