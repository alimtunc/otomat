import { Input, Textarea, cn } from "@otomat/ui";
import { useState } from "react";

interface InlineTextFieldProps {
  value: string;
  placeholder: string;
  ariaLabel: string;
  multiline?: boolean;
  disabled?: boolean;
  className?: string;
  onCommit: (next: string) => void;
}

export function InlineTextField({
  value,
  placeholder,
  ariaLabel,
  multiline = false,
  disabled = false,
  className,
  onCommit,
}: InlineTextFieldProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  function commit(): void {
    setEditing(false);
    const next = multiline ? text : text.trim();
    if (next !== value) onCommit(next);
  }

  function cancel(): void {
    setEditing(false);
    setText(value);
  }

  if (!editing) {
    const empty = value.length === 0;
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={disabled ? ariaLabel : `Edit ${ariaLabel.toLowerCase()}`}
        onClick={() => {
          setText(value);
          setEditing(true);
        }}
        className={cn(
          "-mx-1.5 block w-[calc(100%+0.75rem)] whitespace-pre-wrap rounded-md px-1.5 text-left",
          disabled ? "" : "cursor-text transition-colors duration-100 hover:bg-surface-2/60",
          empty ? "text-text-tertiary" : "",
          className,
        )}
      >
        {empty ? placeholder : value}
      </button>
    );
  }

  const sharedClass = cn(
    "-mx-1.5 block h-auto w-[calc(100%+0.75rem)] rounded-md border-0 bg-surface-2/60 px-1.5 py-0 font-[inherit] text-[inherit] shadow-none outline-none focus:border-transparent focus:shadow-none",
    className,
  );

  if (multiline) {
    return (
      <Textarea
        autoFocus
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
        }}
        className={cn(sharedClass, "field-sizing-content min-h-0 resize-none leading-[inherit]")}
      />
    );
  }

  return (
    <Input
      autoFocus
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") cancel();
      }}
      className={sharedClass}
    />
  );
}
