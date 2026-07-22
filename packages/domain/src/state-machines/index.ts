/**
 * Pure finite state machines for the domain entities (issue, run, step-run,
 * agent-session, review, review-comment, pull-request). `defineMachine` builds a
 * StateMachine whose `transition` throws IllegalTransitionError on an illegal
 * edge; terminal states have no outgoing edges, and `shortestPath` returns null
 * when the target state is unreachable.
 *
 * @packageDocumentation
 */
export { IllegalTransitionError, drivePath } from "./machine.js";
export * from "./issue.js";
export * from "./run.js";
export * from "./step-run.js";
export * from "./agent-session.js";
export * from "./compete-group.js";
export * from "./review.js";
export * from "./review-comment.js";
export * from "./pull-request.js";
export * from "./pull-request-publication.js";
export * from "./linear-write.js";
