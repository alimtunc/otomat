export class SourceControlError extends Error {
  constructor(
    public readonly code:
      | "checkout_stale"
      | "checkout_conflicted"
      | "change_unavailable"
      | "selection_unavailable"
      | "path_invalid"
      | "commit_failed",
    message: string,
  ) {
    super(message);
    this.name = "SourceControlError";
  }
}
