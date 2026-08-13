/**
 * The declarative context a session receives: `createContextFreezer` resolves what a
 * launch surface attached into the content the plan freezes, `buildSessionContext` adds
 * the cycle's own state at session start, and `renderSessionContext` turns that envelope
 * into the provider's text. Every read is local — this daemon's database and git — so an
 * agent never calls a tracker and is never handed a credential to do so.
 *
 * @packageDocumentation
 */
export { buildSessionContext } from "./dossier.js";
export { readContextFile } from "./files.js";
export { createContextFreezer, type ContextFreezer } from "./freeze.js";
export type { ContextIssueRow } from "./issues.js";
export { renderSessionContext } from "./render.js";
export { reviewCommentContext } from "./review.js";
