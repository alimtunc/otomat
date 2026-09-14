import { IconButton } from "@otomat/ui";
import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type IconLinkProps = LinkProps & {
  label: string;
  icon: ReactNode;
};

export function IconLink({ label, icon, ...link }: IconLinkProps) {
  return (
    <IconButton
      label={label}
      icon={icon}
      nativeButton={false}
      role="link"
      render={<Link {...link} />}
    />
  );
}
