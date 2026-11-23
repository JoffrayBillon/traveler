# Security and operations

This repository is public. Commit only synthetic examples. Never commit participant spreadsheets, names/emails tied to bookings, tickets, database dumps, session data, magic links, credentials, private logs, or browser state. Keep those outside the checkout; ignored directories are an extra guard, not a privacy boundary. Inspect staged diffs before publishing. Report a leak without reposting its contents; revoke exposed credentials and handle history cleanup explicitly.

Authentication is closed membership: no public signup, server-side membership and role authorization, indistinguishable public acknowledgements for known/unknown emails, database-backed rate limiting and secure session cookies. The login endpoint acknowledges before checking membership and processes the authentication request in a background task, so account lookup time does not affect the public response. The form persists a five-minute per-address cooldown across reloads and browser tabs; the server enforces one request per normalized email every five minutes using a SHA-256 email key, plus Better Auth's five-per-minute client-IP limit. Manager-generated copied links send no email and use the native Better Auth rate limit independently of the per-address email cooldown. The endpoint only sends a link to an existing trip member; an imported address is not yet verified. Magic links expire after one hour. GET/HEAD opens a confirmation page without redeeming the token, and a read-only preview exposes only first and last names for an unexpired token. The confirmation form submits a same-origin POST before Better Auth atomically consumes the token and creates a session. Expired links never trigger another email automatically. Better Auth marks the address verified only after its single-use link is redeemed. The bootstrap migration provisions the initial manager only if no account exists. Use the explicit local operator command for additional managers; clients cannot assign themselves privileges. Keep the auth secret and SMTP credentials in environment variables and never log sign-in links or tokens.

Uploads require bounded sizes, type/content validation, generated storage keys and private storage. Download authorization checks the requesting user's trip and permissions. Never place tickets in frontend public assets, Git, logs or an unauthenticated public bucket.

Train imports retain one private source PDF per segment and content hash. Limit each PDF to 4 MiB and 200 pages. Staff review and explicitly publish assignments from that source. Traveler downloads verify current group and seat membership and serve only the assigned pages. Collective coverage exposes a status to the traveler while staff retains access to the source. Include the source and its review metadata in the same J+90 purge as other train ticket documents. Use synthetic PDFs for CI and hosted previews.

## Trip data retention

Set the actual end date in **Journey and options** before enrolling travelers. The daily production job at `/api/cron/purge-expired-trips` requires `CRON_SECRET`. At the first run at least 90 days after that date (UTC), it deletes the trip, including cancelled bookings, emergency contacts, transport, rooms, requests and history. Global accounts and credentials survive only while associated with another trip. If the last trip for a manager is removed, provision their access to the next trip using the operator commands. Files in private Vercel Blob are removed through the existing durable queue and retried after failures. Cron returns counts only, with a 503 when Blob deletions need retry.

Before the first production rollout, use a read-only database query to review the trip IDs and dates that the first job will purge. Fill in or correct missing and invalid end dates using the actual end date. Validate the run on a test database with synthetic data. After rollout, check daily job outcomes and investigate failures without logging personal fields or file paths.

```sql
SELECT id, ends_on
FROM trips
WHERE ends_on <= date('now', '-90 days')
  AND date(ends_on, '+0 days') = ends_on;
```

The job covers Traveler's active database and private ticket storage. Set retention separately for provider logs, backups and exported spreadsheets. Run the purge on a restored backup before making the restored database available to the app so expired data is not put back into service. Coordinate deletion of copies shared with the travel agency separately.

The same job removes expired sessions, sign-in verifications, import previews and sign-in counters even when no trip is due for deletion. It removes Better Auth rate-limit entries after 24 hours of inactivity. Check eligible rows with this read-only query:

```sql
WITH cutoff(now_ms) AS (SELECT unixepoch() * 1000)
SELECT 'session' AS table_name, count(*) AS eligible
FROM "session", cutoff WHERE "expiresAt" <= now_ms
UNION ALL
SELECT 'verification', count(*)
FROM "verification", cutoff WHERE "expiresAt" <= now_ms
UNION ALL
SELECT 'trip_import_previews', count(*)
FROM trip_import_previews, cutoff WHERE expires_at <= now_ms
UNION ALL
SELECT 'sign_in_rate_limits', count(*)
FROM sign_in_rate_limits, cutoff WHERE expires_at <= now_ms
UNION ALL
SELECT 'rateLimit', count(*)
FROM "rateLimit", cutoff WHERE "lastRequest" <= now_ms - 86400000;
```

Use separate development, preview and production resources and credentials. The current feature-preview workflow has no database credentials; provision an isolated preview database before enabling them rather than sharing `traveler-dev` or production with arbitrary feature code. The trusted `dev` and `main` deployment workflows fetch only the matching Vercel environment variables with `vercel env run` for the explicit migration step; they do not copy database tokens into GitHub secrets or files. The `dev` workflow uses `workflow_run` to execute the trusted workflow definition from the default branch. Those workflow changes take effect for `dev` after they reach the default branch; until then its existing default-branch workflow handles deployments. Redact secrets, ticket contents and authentication links from logs. Define retention, backup and restoration checks before real traveler data is stored. An Excel rooming export does not replace a database backup. Do not silently fall back to a fake successful external response.

Dependency versions and lockfile are reviewed together. The workspace permits the specific esbuild version's required installation script only. CI jobs that execute unreviewed pull-request code receive no deployment secrets. Do not use `pull_request_target` to run a PR checkout with elevated credentials.
