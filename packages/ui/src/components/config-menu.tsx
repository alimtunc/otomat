import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  type DropdownMenuContentProps,
} from "../primitives/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { Icon } from "./icon";
import { Spinner } from "./spinner";

/** `--available-height` is what the positioner measured after collision handling. */
const POPUP_CLASS =
  "max-h-[min(22rem,var(--available-height))] min-w-56 max-w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain";

/** Items that stack a description under their label opt out of the single-line menu item height. */
const STACKED_ITEM_CLASS = "h-auto items-start py-1.5";

export const ConfigMenu = DropdownMenu;

export type ConfigMenuContentProps = DropdownMenuContentProps;

export function ConfigMenuContent({ className, ...props }: ConfigMenuContentProps) {
  return <DropdownMenuContent className={cn(POPUP_CLASS, className)} {...props} />;
}

export interface ConfigMenuTriggerProps {
  label: string;
  summary: string;
  /** The accessible name's value when the summary leaves something to the leading art. */
  announce?: string;
  /** Everything the one-line summary had to drop, so it never has to carry it. */
  detail?: ReactNode;
  leading?: ReactNode;
  size?: "xs" | "sm";
  disabled?: boolean;
  pending?: boolean;
  className?: string;
}

export function ConfigMenuTrigger({
  label,
  summary,
  announce,
  detail,
  leading,
  size = "sm",
  disabled = false,
  pending = false,
  className,
}: ConfigMenuTriggerProps) {
  const trigger = (
    <DropdownMenuTrigger
      render={
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={disabled}
          aria-label={`${label}: ${announce ?? summary}`}
          className={cn("min-w-0 max-w-full justify-start gap-1.5", className)}
        >
          {leading}
          <span className={cn("truncate", size === "xs" && "text-xs")}>{summary}</span>
          {pending ? (
            <Spinner size={size === "xs" ? 12 : 14} label="Loading configuration" />
          ) : (
            <Icon name="chevron-down" aria-hidden className="shrink-0 text-text-tertiary" />
          )}
        </Button>
      }
    />
  );

  if (detail === undefined) return trigger;
  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent className="max-w-72 whitespace-normal">{detail}</TooltipContent>
    </Tooltip>
  );
}

interface ConfigMenuRowProps {
  label: ReactNode;
  value: ReactNode;
  title?: string;
}

function ConfigMenuRow({ label, value, title }: ConfigMenuRowProps) {
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="shrink-0">{label}</span>
      <span className="line-clamp-2 min-w-0 text-right text-xs text-text-tertiary" title={title}>
        {value}
      </span>
    </span>
  );
}

export interface ConfigMenuSubmenuProps {
  label: string;
  value: string;
  /** Where the value comes from, or how it was detected: reachable, but never part of the visible row. */
  hint?: string;
  disabled?: boolean;
  children: ReactNode;
}

export function ConfigMenuSubmenu({
  label,
  value,
  hint,
  disabled = false,
  children,
}: ConfigMenuSubmenuProps) {
  const full = hint === undefined ? `${label}: ${value}` : `${label}: ${value}. ${hint}`;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled} aria-label={full}>
        <ConfigMenuRow label={label} value={value} title={full} />
      </DropdownMenuSubTrigger>
      <ConfigMenuContent aria-label={label}>{children}</ConfigMenuContent>
    </DropdownMenuSub>
  );
}

export interface ConfigMenuChoiceProps {
  value: string;
  label: string;
  /** Wraps rather than truncating: it is the only place the choice is explained. */
  description?: string | null;
  /** The verbatim identifier behind a humanized label, kept visible so the CLI value is never guessed. */
  hint?: string;
  disabled?: boolean;
  leading?: ReactNode;
}

export function ConfigMenuChoice({
  value,
  label,
  description = null,
  hint,
  disabled = false,
  leading,
}: ConfigMenuChoiceProps) {
  return (
    <DropdownMenuRadioItem
      value={value}
      disabled={disabled}
      className={cn(description !== null && STACKED_ITEM_CLASS)}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          {leading}
          <span className="truncate" title={label}>
            {label}
          </span>
          {hint === undefined ? null : (
            <code className="shrink-0 text-micro text-text-tertiary">{hint}</code>
          )}
        </span>
        {description === null ? null : (
          <span className="text-xs whitespace-normal text-text-tertiary">{description}</span>
        )}
      </span>
    </DropdownMenuRadioItem>
  );
}

export interface ConfigMenuCheckProps {
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
  leading?: ReactNode;
}

/** Stays open on click: a multi-selection is built up, not picked once. */
export function ConfigMenuCheck({
  label,
  checked,
  onCheckedChange,
  leading,
}: ConfigMenuCheckProps) {
  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      closeOnClick={false}
      onCheckedChange={onCheckedChange}
    >
      <span className="flex min-w-0 items-center gap-2">
        {leading}
        <span className="truncate" title={label}>
          {label}
        </span>
      </span>
    </DropdownMenuCheckboxItem>
  );
}

/** Not a group label: it names no group, so it must not be announced as one. */
export function ConfigMenuNote({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1.5 text-xs whitespace-normal text-text-tertiary">{children}</p>;
}

export interface ConfigMenuProblemProps {
  message: string;
  onRetry: () => void;
}

export function ConfigMenuProblem({ message, onRetry }: ConfigMenuProblemProps) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5">
      <p role="alert" className="min-w-0 flex-1 text-xs whitespace-normal text-danger">
        {message}
      </p>
      <Button type="button" variant="ghost" size="xs" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
