const required = [
  "DEPLOY_KIND",
  "DEPLOY_REF",
  "DEPLOY_SHA",
  "GITHUB_REPOSITORY_ID",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "VERCEL_TOKEN",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required variable: ${name}`);
}

const { DEPLOY_KIND, DEPLOY_REF, DEPLOY_SHA } = process.env;
const isFeatureBranch = /^(codex|feature)[/][A-Za-z0-9._/-]+$/.test(DEPLOY_REF);

if (DEPLOY_KIND === "development" && DEPLOY_REF !== "dev") {
  throw new Error("Development deployments must use the dev branch");
}
if (DEPLOY_KIND === "preview" && !isFeatureBranch) {
  throw new Error("Preview deployments require a codex/* or feature/* branch");
}
if (!["development", "preview"].includes(DEPLOY_KIND)) {
  throw new Error("Unsupported deployment kind");
}
if (!/^[0-9a-f]{40}$/i.test(DEPLOY_SHA)) {
  throw new Error("Deployment commit must be a full Git SHA");
}

const teamQuery = new URLSearchParams({ teamId: process.env.VERCEL_ORG_ID });
const apiUrl = `https://api.vercel.com/v13/deployments?${teamQuery}`;
const headers = {
  Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
  "Content-Type": "application/json",
};
const body = {
  name: "traveler",
  project: process.env.VERCEL_PROJECT_ID,
  gitSource: {
    type: "github",
    repoId: process.env.GITHUB_REPOSITORY_ID,
    ref: DEPLOY_REF,
    sha: DEPLOY_SHA,
  },
};

async function request(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Vercel API returned non-JSON (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const message =
      typeof result.error?.message === "string"
        ? result.error.message
        : `HTTP ${response.status}`;
    throw new Error(`Vercel deployment request failed: ${message}`);
  }
  return result;
}

const deployment = await request(apiUrl, {
  method: "POST",
  headers,
  body: JSON.stringify(body),
});

if (typeof deployment.id !== "string" || typeof deployment.url !== "string") {
  throw new Error("Vercel did not return a deployment ID and URL");
}

const deploymentUrl = `https://${deployment.url}`;
const statusUrl = `https://api.vercel.com/v13/deployments/${encodeURIComponent(deployment.id)}?${teamQuery}`;

for (let attempt = 0; attempt < 90; attempt += 1) {
  const status = await request(statusUrl, { headers });
  const state = String(status.readyState ?? status.state ?? "").toUpperCase();

  if (state === "READY") {
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub Actions provides this output file at runtime.
    const output = process.env.GITHUB_OUTPUT;
    if (!output) throw new Error("GITHUB_OUTPUT is unavailable");
    const { appendFile } = await import("node:fs/promises");
    const aliases = Array.isArray(status.alias) ? status.alias : [];
    const stableDevAlias =
      DEPLOY_KIND === "development"
        ? aliases.find(
            (alias) =>
              alias.startsWith("traveler-git-dev-") &&
              alias.endsWith(".vercel.app"),
          )
        : undefined;
    const resultUrl = stableDevAlias
      ? `https://${stableDevAlias}`
      : deploymentUrl;
    if (DEPLOY_KIND === "development" && !stableDevAlias) {
      console.warn(
        "Vercel did not return the stable dev branch alias; reporting the unique deployment URL.",
      );
    }
    await appendFile(output, `url=${resultUrl}\n`, "utf8");
    const environmentLabel =
      DEPLOY_KIND === "development" ? "Preview for dev" : "Preview";
    console.log(`Deployment ready (${environmentLabel}): ${resultUrl}`);
    process.exit(0);
  }
  if (["ERROR", "CANCELED"].includes(state)) {
    throw new Error(`Vercel deployment finished in ${state}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 10_000));
}

throw new Error(`Timed out waiting for Vercel deployment: ${deploymentUrl}`);
