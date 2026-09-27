import type { PullRequestStackMember } from "@otomat/domain";
import { cn, FOCUS_RING, Icon, PRStatusBadge } from "@otomat/ui";

export function StackMemberItem({
  member,
  index,
  isCurrent,
}: {
  member: PullRequestStackMember;
  index: number;
  isCurrent: boolean;
}) {
  return (
    <li className="relative pb-3 pl-7 before:absolute before:bottom-0 before:left-2.5 before:top-5 before:w-px before:bg-border-subtle last:pb-0 last:before:hidden">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 flex size-5 items-center justify-center rounded-full border text-micro tabular-nums",
          isCurrent
            ? "border-border-strong bg-surface-3 font-medium text-foreground"
            : "border-border-subtle bg-surface-2 text-text-tertiary",
        )}
      >
        {index + 1}
      </span>
      <div
        className={cn(
          "rounded-md border p-2",
          isCurrent ? "border-border-strong bg-surface-3" : "border-transparent bg-surface-1",
        )}
      >
        <a
          href={member.url}
          target="_blank"
          rel="noreferrer"
          aria-current={isCurrent ? "true" : undefined}
          className={`group block rounded-sm hover:text-foreground ${FOCUS_RING}`}
        >
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="font-mono">#{member.number}</span>
            {isCurrent ? <span className="font-medium text-foreground">Current PR</span> : null}
            <Icon
              name="external-link"
              size="xs"
              className="ml-auto text-text-tertiary group-hover:text-foreground"
            />
          </span>
          <span className="mt-1.5 block break-words text-xs leading-relaxed">{member.title}</span>
        </a>
        <div className="mt-2">
          <PRStatusBadge status={member.status} />
        </div>
        <details className="mt-1 text-xs text-text-tertiary">
          <summary className={`cursor-pointer rounded-sm py-1 hover:text-foreground ${FOCUS_RING}`}>
            Branches
          </summary>
          <p className="mt-1 break-all font-mono leading-relaxed">
            {member.head_ref} → {member.base_ref}
          </p>
        </details>
      </div>
    </li>
  );
}
