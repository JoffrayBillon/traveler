import { ApiError } from "@traveler/api/client";
import type { ImportPreviewResponse } from "./import.types";

export function getImportErrorPayload(error: unknown): ImportPreviewResponse {
  const payload = error instanceof ApiError ? error.payload : null;
  return payload && typeof payload === "object"
    ? (payload as ImportPreviewResponse)
    : {};
}
