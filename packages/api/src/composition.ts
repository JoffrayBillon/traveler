import { drizzle } from "drizzle-orm/libsql";
import { scheduleVercelBackgroundTask } from "./adapters/background-task/vercel-background-task.adapter";
import { createBrevoMagicLinkSender } from "./adapters/email/brevo-magic-link.adapter";
import { type AuthServices, createAuth, createMagicLinkCapture } from "./auth";
import { createDatabaseClientFromConfiguration } from "./database";
import {
  type ApiEnvironment,
  EnvironmentValidationError,
  formatEnvironmentReport,
  getEnvironmentWarnings,
  validateEnvironment,
} from "./environment";
import type { BackgroundTaskScheduler } from "./ports/background-task-scheduler";
import * as schema from "./schema";

export function createAuthServicesProvider(
  env: NodeJS.ProcessEnv = process.env,
): () => AuthServices | undefined {
  let services: AuthServices | undefined;
  let initialized = false;

  return () => {
    if (initialized) return services;
    initialized = true;

    let configuration: ApiEnvironment;
    try {
      configuration = validateEnvironment("api", env);
    } catch (error) {
      reportInitializationError(error);
      return undefined;
    }

    const warnings = getEnvironmentWarnings("api", env);
    if (warnings.length) {
      console.warn(
        formatEnvironmentReport(
          "api",
          warnings,
          "Optional environment variables are not configured",
        ),
      );
    }

    const client = createDatabaseClientFromConfiguration(configuration);
    if (!client) return undefined;

    try {
      const database = drizzle({ client, schema });
      const magicLinkCapture = createMagicLinkCapture();
      const scheduleBackgroundTask: BackgroundTaskScheduler = (task) => {
        if (env.VERCEL) scheduleVercelBackgroundTask(task);
        else void task;
      };

      services = {
        auth: createAuth(
          database,
          env,
          createBrevoMagicLinkSender(
            configuration.BREVO_API_KEY,
            configuration.BREVO_SENDER_EMAIL,
          ),
          magicLinkCapture,
        ),
        database,
        scheduleBackgroundTask,
        magicLinkCapture,
      };
      return services;
    } catch (error) {
      reportInitializationError(error);
      return undefined;
    }
  };
}

function reportInitializationError(error: unknown) {
  if (error instanceof EnvironmentValidationError) {
    console.error(formatEnvironmentReport(error.profile, error.issues));
    return;
  }

  console.error(
    "Could not initialize authentication services.",
    error instanceof Error ? error.name : "UnknownError",
  );
}
