/**
 * Reusable agent profiles and the local skills catalog. Owns skill discovery
 * from known filesystem roots, profile/skill validation, resolution of a profile
 * (or ad-hoc runtime) into the immutable {@link ResolvedAgentConfig} frozen into
 * a run plan, and composition of the effective turn prompt. Consumed by the API
 * routes (CRUD + discovery) and the supervisor (freeze + worker). Skills are
 * declarative instructions — never executed.
 *
 * @packageDocumentation
 */
export * from "./errors.js";
export * from "./resolve.js";
export { composeTurnPrompt } from "./prompt.js";
export { rescanSkills } from "./skills/catalog.js";
export { skillDiscoveryRoots, type SkillRoot, type SkillRootsOptions } from "./skills/roots.js";
