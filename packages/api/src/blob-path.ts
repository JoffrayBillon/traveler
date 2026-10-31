type BlobPathEnvironment = {
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
};

function previewNamespace(branch: string | undefined) {
  const safeBranch = branch?.trim();

  return `preview/${safeBranch ? encodeURIComponent(safeBranch) : "unknown"}`;
}

function blobNamespace(environment: BlobPathEnvironment) {
  switch (environment.VERCEL_ENV) {
    case "production":
      return "production";
    case "preview":
      return previewNamespace(environment.VERCEL_GIT_COMMIT_REF);
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
