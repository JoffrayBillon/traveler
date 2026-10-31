type BlobPathEnvironment = {
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  VERCEL_DEPLOYMENT_ID?: string;
  VERCEL_URL?: string;
};

function previewNamespace(
  branch: string | undefined,
  deploymentId: string | undefined,
) {
  const safeBranch = branch?.trim();
  const safeDeployment = deploymentId?.trim();

  const branchNamespace = safeBranch
    ? encodeURIComponent(safeBranch)
    : "unknown";
  return `preview/${branchNamespace}/${safeDeployment ? encodeURIComponent(safeDeployment) : "deployment-unknown"}`;
}

function blobNamespace(environment: BlobPathEnvironment) {
  switch (environment.VERCEL_ENV) {
    case "production":
      return "production";
    case "preview":
      return previewNamespace(
        environment.VERCEL_GIT_COMMIT_REF,
        environment.VERCEL_DEPLOYMENT_ID ?? environment.VERCEL_URL,
      );
    case "development":
      return "development";
    default:
      return environment.VERCEL ? "vercel/unknown" : "local";
  }
}

export function createTicketBlobPath(
  tripId: string,
  userId: string,
  ticketId: string,
  environment: BlobPathEnvironment = process.env,
) {
  return `${blobNamespace(environment)}/trips/${tripId}/travelers/${userId}/${ticketId}`;
}
