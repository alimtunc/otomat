import { Icon } from "./icon";
import { IconButton } from "./icon-button";

export interface ExternalLinkIconButtonProps {
  href: string;
  label: string;
}

export function ExternalLinkIconButton({ href, label }: ExternalLinkIconButtonProps) {
  return (
    <IconButton
      label={label}
      icon={<Icon name="external-link" aria-hidden />}
      nativeButton={false}
      role="link"
      render={<a href={href} target="_blank" rel="noreferrer" aria-label={label} />}
    />
  );
}
