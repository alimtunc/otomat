import type { KeyboardEvent } from "react";

export interface FieldMetaLike {
  isTouched: boolean;
  isValid: boolean;
  errors: readonly unknown[];
}

/** Maps a TanStack Form field's `meta` to the `Field` component's `invalid` / `error` props. */
export function fieldErrorProps(meta: FieldMetaLike): {
  invalid: boolean;
  error: string | undefined;
} {
  const [first] = meta.errors;
  return {
    invalid: meta.isTouched && !meta.isValid,
    error: meta.isTouched && typeof first === "string" ? first : undefined,
  };
}

export function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function requiredTrimmed(message: string) {
  return ({ value }: { value: string }): string | undefined =>
    hasText(value) ? undefined : message;
}

export function submitOnCmdEnter(submit: () => void) {
  return (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };
}
