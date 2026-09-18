import {
  CONTRIBUTION_IMAGES_BODY_LIMIT_BYTES,
  createRunContributionRequestSchema,
  type CreateRunContributionRequest,
} from "@otomat/domain";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import type { ApiDeps } from "#api/deps";
import { runGuard, type RunEnv } from "#api/guards";
import { readRunContributions } from "#api/reads";
import { invalidRequestJson } from "#api/refusal";
import { toRunContribution } from "#api/serialize";
import {
  RunContributionImageError,
  RunContributionNotCancelableError,
  RunContributionNotFoundError,
  RunContributionNotRetriableError,
  RunContributionStepClosedError,
  RunContributionTargetChangedError,
} from "#supervisor";

interface ContributionPost {
  request: CreateRunContributionRequest;
  uploads: Uint8Array[];
}

const EMPTY_MESSAGE = [{ path: ["body"], message: "Write a message or attach an image." }];

const requestTextSchema = z
  .string()
  .transform((text, ctx) => {
    try {
      return JSON.parse(text);
    } catch {
      ctx.addIssue({ code: "custom", message: "The request is not valid JSON." });
      return z.NEVER;
    }
  })
  .pipe(createRunContributionRequestSchema);

/** A message with images posts multipart whose `request` part is the text-only JSON, so a file never goes through a string. */
async function readContributionPost(c: Context<RunEnv>): Promise<ContributionPost | Response> {
  let text = "";
  const uploads: Uint8Array[] = [];
  if (c.req.header("content-type")?.startsWith("multipart/form-data")) {
    const form = await c.req.formData();
    const request = form.get("request");
    if (typeof request === "string") text = request;
    for (const part of form.getAll("images")) {
      if (part instanceof File) uploads.push(new Uint8Array(await part.arrayBuffer()));
    }
  } else {
    text = await c.req.text();
  }
  const parsed = requestTextSchema.safeParse(text);
  if (!parsed.success) return invalidRequestJson(c, parsed.error.issues);
  if (parsed.data.body.length === 0 && uploads.length === 0) {
    return invalidRequestJson(c, EMPTY_MESSAGE);
  }
  return { request: parsed.data, uploads };
}

/** Mounted at `/api/runs`. The step conversation surface: a post always persists the message and returns its honest delivery state. */
export function createRunContributionRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/contributions", runGuard(deps.db), (c) =>
    c.json(readRunContributions(deps.db, c.get("run").id)),
  );

  routes.post(
    "/:id/contributions",
    bodyLimit({ maxSize: CONTRIBUTION_IMAGES_BODY_LIMIT_BYTES }),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      const post = await readContributionPost(c);
      if (post instanceof Response) return post;
      const { step_run_id, target_agent_session_id, target_config_hash, body } = post.request;
      try {
        const row = await deps.supervisor.contribute(
          run.id,
          step_run_id,
          target_agent_session_id,
          target_config_hash,
          body,
          post.uploads,
        );
        return c.json(toRunContribution(row), 201);
      } catch (error) {
        if (error instanceof RunContributionNotFoundError) {
          return c.json({ error: "run_contribution_step_not_found", message: error.message }, 404);
        }
        if (error instanceof RunContributionStepClosedError) {
          return c.json({ error: "run_contribution_step_closed", message: error.message }, 409);
        }
        if (error instanceof RunContributionTargetChangedError) {
          return c.json({ error: error.code, message: error.message }, 409);
        }
        if (error instanceof RunContributionImageError) {
          return c.json(
            { error: `run_contribution_${error.code}`, message: error.message },
            error.code === "image_invalid" ? 400 : 409,
          );
        }
        console.error(`[otomat] contribution on run ${run.id} failed`, error);
        return c.json({ error: "run_contribution_failed" }, 500);
      }
    },
  );

  routes.get("/:id/contributions/:contributionId/images/:imageId", runGuard(deps.db), (c) => {
    const image = deps.supervisor.contributionImage(
      c.get("run").id,
      c.req.param("contributionId"),
      c.req.param("imageId"),
    );
    if (image === null) return c.json({ error: "run_contribution_image_not_found" }, 404);
    // An image id is minted once and its bytes never change, so a cached copy is exact for as long as it lives.
    return c.body(new Uint8Array(image.bytes), 200, {
      "content-type": image.media_type,
      "cache-control": "private, max-age=31536000, immutable",
    });
  });

  routes.post("/:id/contributions/deliver", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      await deps.supervisor.deliverContributions(run.id);
    } catch (error) {
      console.error(`[otomat] contribution delivery on run ${run.id} failed`, error);
      return c.json({ error: "run_contribution_delivery_failed" }, 500);
    }
    return c.json(readRunContributions(deps.db, run.id));
  });

  routes.post("/:id/contributions/:contributionId/retry", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      const row = await deps.supervisor.retryContribution(run.id, c.req.param("contributionId"));
      return c.json(toRunContribution(row));
    } catch (error) {
      if (error instanceof RunContributionNotFoundError) {
        return c.json({ error: "run_contribution_not_found", message: error.message }, 404);
      }
      if (error instanceof RunContributionNotRetriableError) {
        return c.json({ error: "run_contribution_not_retriable", message: error.message }, 409);
      }
      console.error(`[otomat] contribution retry on run ${run.id} failed`, error);
      return c.json({ error: "run_contribution_retry_failed" }, 500);
    }
  });

  routes.post("/:id/contributions/:contributionId/cancel", runGuard(deps.db), (c) => {
    const run = c.get("run");
    try {
      const row = deps.supervisor.cancelContribution(run.id, c.req.param("contributionId"));
      return c.json(toRunContribution(row));
    } catch (error) {
      if (error instanceof RunContributionNotFoundError) {
        return c.json({ error: "run_contribution_not_found", message: error.message }, 404);
      }
      if (error instanceof RunContributionNotCancelableError) {
        return c.json({ error: "run_contribution_not_cancelable", message: error.message }, 409);
      }
      console.error(`[otomat] contribution cancel on run ${run.id} failed`, error);
      return c.json({ error: "run_contribution_cancel_failed" }, 500);
    }
  });

  return routes;
}
