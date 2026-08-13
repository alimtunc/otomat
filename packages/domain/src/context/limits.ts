export const CONTEXT_NOTE_MAX_LENGTH = 20_000;
export const CONTEXT_MAX_REFERENCES = 20;
export const CONTEXT_FILE_PATH_MAX_LENGTH = 400;
/** A referenced file is read whole or refused; past this it stops being context and becomes the payload. */
export const CONTEXT_FILE_MAX_BYTES = 128_000;
export const CONTEXT_ISSUE_BODY_MAX_LENGTH = 20_000;
export const CONTEXT_MAX_DIFF_FILES = 100;
export const CONTEXT_MAX_COMMITS = 20;
export const CONTEXT_MAX_REVIEW_COMMENTS = 50;
export const CONTEXT_REVIEW_FILE_MAX_LENGTH = 16_000;
/** Per previous step: enough to say what it did, never its whole transcript. */
export const CONTEXT_STEP_REPORT_MAX_LENGTH = 4_000;
