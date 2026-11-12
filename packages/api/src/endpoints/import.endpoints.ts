import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { registerImportCommitEndpoint } from "./import-commit.endpoint";
import { registerImportPreviewEndpoint } from "./import-preview.endpoint";

export function registerImportEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  registerImportPreviewEndpoint(app, getAuthServices);
  registerImportCommitEndpoint(app, getAuthServices);
}
