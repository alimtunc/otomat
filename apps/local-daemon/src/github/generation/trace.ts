import { safeGitHubFailure } from "../errors.js";

function formatDuration(ms: number): string {
  return ms < 1000 ? `${String(Math.round(ms))}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function formatSize(characters: number): string {
  return `${String(Math.round(characters / 1000))} kchar`;
}

/** One redacted line per attempt: step durations, sizes and exit codes, never the diff, the prompt or the answer. */
export class GenerationTrace {
  private readonly steps: string[] = [];
  private mark = performance.now();

  constructor(private readonly subject: string) {}

  step(name: string, detail = ""): void {
    const now = performance.now();
    const duration = formatDuration(now - this.mark);
    this.steps.push(detail === "" ? `${name} ${duration}` : `${name} ${duration} (${detail})`);
    this.mark = now;
  }

  finish(error: unknown = null): void {
    const verdict = error === null ? "ok" : `failed ${safeGitHubFailure(error).code}`;
    console.log(
      `[otomat] pr generation for ${this.subject}: ${[...this.steps, verdict].join(" · ")}`,
    );
  }
}

export async function traced<T>(
  subject: string,
  operation: (trace: GenerationTrace) => Promise<T>,
): Promise<T> {
  const trace = new GenerationTrace(subject);
  try {
    const result = await operation(trace);
    trace.finish();
    return result;
  } catch (error) {
    trace.finish(error);
    throw error;
  }
}
