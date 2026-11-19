import { createHash } from "node:crypto";
import { and, eq, gt, like, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

export function revokeMagicLinksForAddress(
  database: Pick<AppDatabase, "delete">,
  email: string,
) {
  const { identifier, value } = schema.verifications;
  return database.delete(schema.verifications).where(
    and(
      like(identifier, "magic-link:%"),
      sql`CASE WHEN json_valid(${value})
        THEN lower(json_extract(${value}, '$.email')) = ${email}
        ELSE 0 END`,
    ),
  );
}

export async function findPendingMagicLink(
  database: AppDatabase,
  token: string,
) {
  // Match Better Auth's hashed magic-link identifier without consuming it.
  const identifier = `magic-link:${createHash("sha256").update(token).digest("base64url")}`;
  const [verification] = await database
    .select({ value: schema.verifications.value })
    .from(schema.verifications)
    .where(
      and(
        eq(schema.verifications.identifier, identifier),
        gt(schema.verifications.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return verification;
}

export async function findMagicLinkIdentity(
  database: AppDatabase,
  email: string,
) {
  const [member] = await database
    .select({
      firstName: schema.tripMemberships.firstName,
      lastName: schema.tripMemberships.lastName,
    })
    .from(schema.tripMemberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.tripMemberships.userId))
    .where(eq(sql<string>`lower(${schema.users.email})`, email.toLowerCase()))
    .limit(1);
  return member;
}
