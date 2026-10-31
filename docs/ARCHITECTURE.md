# Architecture decisions

## 2026-10-26 — Initial foundation

Accepted by the owner: a small Turborepo using pnpm; React 19, Vite, Tailwind and React Aria Components; Hono; TypeScript, Biome and Vitest. The code is public to try CodeRabbit; data and tickets remain private. Use one same-origin Vercel project rather than separate frontend/API deployments. The owner can install, read and run everything manually with documented commands.

Two workspaces carry actual code: `apps/web` and `packages/api`. React Aria controls live in the web app until sharing warrants a UI package. The API package emits native JavaScript/declarations before the web build so Vercel can trace its runtime export. No empty database/domain/design-system package, microservice or generic workflow engine is introduced.

The foundation now includes a lazy Turso/libSQL client, a read-only readiness probe, and checked-in Drizzle SQL migrations. Application startup never applies migrations. GitHub Actions deploys the exact tested `main` commit to Vercel Production after CI succeeds, and the `dev` push deploys to Vercel Preview after its checks. Each deployment job runs an explicit migration step using variables fetched from the matching Vercel environment, then asks Vercel to build and publish the commit. The Vercel build command only builds the app. Feature previews are created on demand through GitHub Actions and do not run migrations. Vercel's automatic Git deployments are disabled, so GitHub Actions is the sole deployment trigger. No secret, participant fixture or real trip record is committed.

## 2026-10-27 — Trip persistence foundation

Add a minimal trip identity and name, SQL migration generation, explicit migration and local operator create/list commands. Keep the table free of speculative dates, status, ownership and membership fields. Authentication, membership and trip management UI remain separate reviewed work.

## 2026-10-30 — Invite-only authentication foundation

Implement the Better Auth passwordless flow already selected in the original mission, using the existing Turso/libSQL database and Brevo's HTTPS transactional email API. New signups stay disabled; the first manager is created only by the local `managers:create` operator command, and later imports will provision traveler accounts. Roles live on trip memberships, never on the global identity. Login links expire after ten minutes, are single-use and stored hashed; sessions last 30 days and refresh daily. Rate limits use the database because the app runs in serverless functions. The API requires trip membership both before sending a link and when creating a session; `/api/me` scopes its response to the current identity.

This is authentication infrastructure, not a finished traveler or management dashboard. Live email requires sender verification and environment configuration; the application never applies migrations automatically.

## 2026-10-31 — Brevo transactional email API

Send passwordless login messages through Brevo's official Node.js SDK over HTTPS using a server-side API key. This removes SMTP host, port, and login configuration and avoids an SMTP socket connection. Bound SDK retries and request timeout for the background login-email task. Brevo API IP blocking can still apply, and the owner must provision a dedicated API key for the application.

Public code does not imply an open-source license grant; no license has been chosen. Reassess hosting plans if the owner changes from personal use to professional/commercial use.
