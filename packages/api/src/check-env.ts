import {
  EnvironmentValidationError,
  formatEnvironmentReport,
  getEnvironmentWarnings,
  validateEnvironment,
} from "./environment";

const args = process.argv
  .slice(2)
  .filter((argument, index) => !(index === 0 && argument === "--"));
const profile = args[0] ?? "api";
if (profile !== "api" && profile !== "database") {
  console.error("Usage: pnpm env:check [api|database]");
  process.exitCode = 1;
} else {
  try {
    if (profile === "api") validateEnvironment("api");
    else validateEnvironment("database");
    const warnings = getEnvironmentWarnings(profile, process.env);
    console.info(`Environment is valid for ${profile}.`);
    if (warnings.length) {
      console.warn(
        formatEnvironmentReport(
          profile,
          warnings,
          "Optional environment variables are not configured",
        ),
      );
    }
  } catch (error) {
    if (error instanceof EnvironmentValidationError) {
      console.error(formatEnvironmentReport(error.profile, error.issues));
    } else {
      console.error("Could not validate the application environment.");
    }
    process.exitCode = 1;
  }
}
