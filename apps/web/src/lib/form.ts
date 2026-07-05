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
