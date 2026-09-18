import type { RuntimeImageCapability } from "@otomat/domain";

import type { RuntimeImageFile } from "#runtime/contract";
import { cachedProviderProbe } from "#runtime/probe/cache";
import { helpDeclaresFlag } from "#runtime/probe/help-flags";

const EXEC_HELP_ARGS = ["exec", "--help"] as const;
const RESUME_HELP_ARGS = ["exec", "resume", "--help"] as const;

const IMAGE_FLAG = "--image";

/** `standalone` is false because `codex exec` still reads its prompt from stdin and refuses an empty one, images or not. */
export function codexImageCapability(binary: string): RuntimeImageCapability {
  for (const args of [EXEC_HELP_ARGS, RESUME_HELP_ARGS]) {
    const probe = cachedProviderProbe(binary, args);
    if (probe.status !== "ok") {
      return {
        status: "unsupported",
        reason: `Codex image capability is unavailable: ${probe.detail}`,
      };
    }
    if (!helpDeclaresFlag(probe.stdout, IMAGE_FLAG)) {
      return {
        status: "unsupported",
        reason: `This Codex CLI does not announce an image flag for \`codex ${args.slice(0, -1).join(" ")}\`.`,
      };
    }
  }
  return { status: "supported", standalone: false };
}

/** One flag per image: the variadic `-i <FILE>...` form would swallow the `-` that names stdin as the prompt. */
export function codexImageArgs(images: readonly RuntimeImageFile[]): string[] {
  return images.flatMap((image) => [IMAGE_FLAG, image.path]);
}

/** The launch log keeps the argv auditable without naming where the daemon keeps a message's images. */
export function withoutImagePaths(args: readonly string[]): string[] {
  return args.map((arg, index) => (args[index - 1] === IMAGE_FLAG ? "[image]" : arg));
}
