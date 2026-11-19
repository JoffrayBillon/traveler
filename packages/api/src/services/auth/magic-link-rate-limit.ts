import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import { signInRateLimits } from "../../schema";

export async function reserveMagicLinkRequest(
  database: AppDatabase,
  scope: "address" | "network" | "manager" | "verification",
  subject: string,
  seconds: number,
  max: number,
) {
  const key = `${scope}:${createHash("sha256").update(subject).digest("hex")}`;
  const now = Date.now();
  const expiresAt = now + seconds * 1000;
  const expired = sql`${signInRateLimits.expiresAt} <= ${now}`;
  const [reserved] = await database
    .insert(signInRateLimits)
    .values({ key, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: signInRateLimits.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${signInRateLimits.count} + 1 END`,
        expiresAt: sql`CASE WHEN ${expired} THEN ${expiresAt} ELSE ${signInRateLimits.expiresAt} END`,
      },
      setWhere: sql`${expired} OR ${signInRateLimits.count} < ${max}`,
    })
    .returning({ key: signInRateLimits.key });
  if (reserved) return null;

  const [entry] = await database
    .select({ expiresAt: signInRateLimits.expiresAt })
    .from(signInRateLimits)
    .where(eq(signInRateLimits.key, key));
  return entry ? Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)) : 1;
}
