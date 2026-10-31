import { describe, expect, it } from "vitest";
import { createTicketBlobPath } from "./blob-path";

describe("ticket blob paths", () => {
  it("isolates preview deployments within their branch", () => {
    expect(
      createTicketBlobPath("trip", "user", "ticket", {
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feature/rooming",
        VERCEL_DEPLOYMENT_ID: "dpl_123",
      }),
    ).toBe(
      "preview/feature%2Frooming/dpl_123/trips/trip/travelers/user/ticket",
    );
  });

  it("uses the unique deployment URL when deployment ID is unavailable", () => {
    expect(
      createTicketBlobPath("trip", "user", "ticket", {
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "dev",
        VERCEL_URL: "traveler-abc.vercel.app",
      }),
    ).toContain("preview/dev/traveler-abc.vercel.app/");
  });

  it("keeps production and local paths in their own namespaces", () => {
    expect(
      createTicketBlobPath("trip", "user", "ticket", {
        VERCEL_ENV: "production",
      }),
    ).toMatch(/^production\//);
    expect(createTicketBlobPath("trip", "user", "ticket", {})).toMatch(
      /^local\//,
    );
  });
});
