import { describe, expect, it } from "vitest";
import { createTicketBlobPath } from "./blob-path";

describe("ticket blob paths", () => {
  it("keeps preview ticket paths stable across deployments of the same branch", () => {
    expect(
      createTicketBlobPath("trip", "user", "ticket", {
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feature/rooming",
      }),
    ).toBe("preview/feature%2Frooming/trips/trip/travelers/user/ticket");
    expect(
      createTicketBlobPath("trip", "user", "ticket", {
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feature/rooming",
      }),
    ).toBe("preview/feature%2Frooming/trips/trip/travelers/user/ticket");
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
