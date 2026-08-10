/** Otomat's own migration assets or catalog could not be read; never a user-data fault. */
export class MigrationRuntimeError extends Error {
  constructor(message: string, options: ErrorOptions) {
    super(message, options);
    this.name = "MigrationRuntimeError";
  }
}

export function throwIfMigrationRuntimeFailure(
  primary: unknown,
  secondary: unknown[],
  message: string,
): void {
  if (!(primary instanceof MigrationRuntimeError)) return;
  if (secondary.length === 0) throw primary;
  throw new MigrationRuntimeError(primary.message, {
    cause: new AggregateError([primary, ...secondary], message, { cause: primary }),
  });
}
