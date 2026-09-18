import { diffMediaTypeSchema, LINEAR_UPLOADS_HOST, type DiffMediaType } from "@otomat/domain";

import { linearError } from "../errors.js";
import type { LinearApiClient } from "./types.js";

export const LINEAR_FILE_MAX_BYTES = 50 * 1024 * 1024;
const LINEAR_FILE_TIMEOUT_MS = 60_000;

const GONE_STATUSES = new Set([403, 404, 410]);

type FileOperations = Pick<LinearApiClient, "downloadFile">;

/** Only Linear's own upload host is fetched with the key, so the header can never reach a third party. */
function uploadUrl(raw: string): string {
  const url = URL.parse(raw);
  if (url === null || url.protocol !== "https:" || url.hostname !== LINEAR_UPLOADS_HOST) {
    throw linearError("linear_media_refused");
  }
  return url.href;
}

function mediaTypeOf(response: Response): DiffMediaType {
  const header = response.headers.get("content-type") ?? "";
  const parsed = diffMediaTypeSchema.safeParse(header.split(";")[0]?.trim().toLowerCase());
  if (!parsed.success) throw linearError("linear_media_refused");
  return parsed.data;
}

function sizeOf(response: Response): number | null {
  const header = response.headers.get("content-length");
  if (header === null) return null;
  const size = Number(header);
  if (!Number.isSafeInteger(size) || size < 0) throw linearError("linear_request_failed");
  if (size > LINEAR_FILE_MAX_BYTES) throw linearError("linear_media_refused");
  return size;
}

function refuseStatus(status: number): void {
  if (status === 200) return;
  if (status === 401) throw linearError("linear_unauthorized");
  if (GONE_STATUSES.has(status)) throw linearError("linear_media_expired");
  throw linearError(status >= 500 ? "linear_unavailable" : "linear_media_refused");
}

export function createFileOperations(): FileOperations {
  return {
    async downloadFile(apiKey, url, signal) {
      const destination = uploadUrl(url);
      const timeout = AbortSignal.timeout(LINEAR_FILE_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(destination, {
          headers: { authorization: apiKey },
          redirect: "manual",
          signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
        });
      } catch (error) {
        throw linearError("linear_unavailable", error);
      }
      try {
        refuseStatus(response.status);
        if (response.body === null) throw linearError("linear_request_failed");
        return { media_type: mediaTypeOf(response), size: sizeOf(response), body: response.body };
      } catch (error) {
        await response.body?.cancel();
        throw error;
      }
    },
  };
}
