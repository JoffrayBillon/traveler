# Traveler — current product specification

This document combines the [original mission](MISSION_ORIGINAL.md) with the owner's decisions on 2026-10-26 and 2026-10-31. It supersedes contradictory examples in the original. The application is for personally organized trips, starting with one ski trip of approximately 160 participants. Design trip ownership and membership for multiple trips; do not implement speculative travel products. Reassess provider plans if use becomes professional.

## Scope and roles

Identity is global; membership and role belong to a trip. A person can participate in several trips with different roles. Options, rooms, assignments, tickets and requests belong to one trip and cannot refer to another trip's members or resources.

| Role                         | Rights within that trip                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `traveler` — voyageur        | View own trip information, tickets, activity and assigned room/roommates; edit eligible carpool/parking preferences; participate in room change requests/consents.                    |
| `companion` — accompagnateur | Retain traveler view; process traveler requests; edit participant activity and transport details, upload transport tickets and manage rooming within the trip.                        |
| `manager` — gestionnaire     | Retain companion capabilities; edit the trip name, import participants, appoint companions, view each member's sign-in history and send a fresh login link to their registered email. |

No public signup. Imported participants receive access using a passwordless email link and a secure persistent session. Importing an email does not establish email verification. Sign-in emails use the sender identity `BotMail <no-reply@joffraybillon.fr>`; verify the sender/domain in Brevo before the first live send. Define initial manager provisioning and recovery before implementing authentication. Participants do not directly edit activity, transport mode, tickets or room assignment. Later, ski day 3 and ski/spa formula changes can be requested and require administrative approval; these forms are outside the initial foundation.

## Rooms and requests

The ski trip has 29 rooms of four and 18 rooms of three: 47 rooms, 170 places, ten spare places if attendance is 160. Actual room identifiers/names are not provided and must not be invented as authoritative inventory. Capacity must be a positive integer and room names must be unique within a trip.

A room change requires agreement from every person whose place changes. If a room changes from single-gender to mixed-gender, every person in the resulting room must approve. Once those people agree, the server applies the change; additional administrator confirmation is not required. A request into a vacancy has the requester's consent and applies immediately unless it makes a single-gender room mixed. Apply capacity, membership, room policy and all required approvals on the server in one atomic operation; an alert in the UI does not enforce the rule. Full-room exchanges are represented as one multi-person proposal and must never temporarily exceed capacity.

Use a proposed change and a versioned composition to prevent applying approvals to a different proposal; this is an implementation safeguard, not a blanket consent to future roommates. This replaces the original global `mixedRoomConsent` algorithm: do not inherit its handling of already mixed rooms as an accepted rule. Consent is stored for a single request and never grants consent to future compositions.

Still to decide: withdrawal after an assignment has been applied, consent expiry and notifications, and initial mixed-room consent collection. Until that is agreed, the initial import and staff placement tools reject assignments that would make a room mixed. Real room names must be supplied by the organizer; the system does not invent them.

## Activities and transport

Ski and spa profiles are mutually exclusive. Ski day 3 requires the skier profile. Modes are train, flight or none, with outbound/return legs. Store separate first and last names and complete dates, times/timezones, departure/meeting locations, transport reference and assigned seat where applicable. Staff may add tickets and details after initial import; missing details must be displayed clearly.

For no transport, booking/city fields are empty and carpool/parking controls become eligible. For train/flight, carpool/parking controls are ineligible and incompatible values must not remain active. Parking is a carpool sub-option: it is offered only while carpooling is selected and is cleared when that option is turned off.

## Import/export and privacy

Import uses the original mission's `.xlsx` columns and a generated blank template. It validates the whole workbook before writing, explains row-level failures, normalizes addresses, detects duplicates and invalid room references, and applies the accepted batch atomically. Re-import is idempotent: imported columns and participant identity fields are updated; trip roles, assigned rooms, staff-entered location/date details and uploaded tickets are preserved. 160 is the expected ski attendance, not a hardcoded system-wide maximum. Limit import and ticket uploads to 4 MB, import to 500 participant rows and 20 MB uncompressed workbook contents; validate activity, transport, times and room references.

Rooming export includes room/capacity/status and occupants' first/last names, gender and email, ordered deterministically. The original template is not supplied; its layout must be provided or designed before exporter implementation. Real exports/imports never belong in the public repository.

Keep tickets in one private Vercel Blob store with authorized server upload/download routes. Prefix paths by Vercel environment and, for previews, deployment branch; keep the path stable across redeployments so a new deployment can still read previously uploaded tickets. Vercel Functions use short-lived OIDC credentials from the connected store; local development outside Vercel uses `BLOB_READ_WRITE_TOKEN` and a `local/` path prefix. Do not log ticket contents, URLs, names or credentials. Retention and backup policy still need to be agreed. Accessibility includes React Aria controls, keyboard/touch alternatives to room drag-and-drop and real mobile verification; see the [guide](contributing/04-accessibility-rgaa.md).

## Current delivery boundary

The foundation includes tooling, local scripts, an accessible themed shell, API liveness and readiness endpoints, tests, CI/CD configuration and contributor/AI documentation. Managers can edit a trip name, appoint companions, download an import template, import participants and export rooming. Companions can edit participant activity and transport details, add travel tickets, create rooms and place unassigned participants; travelers can view their own travel details, tickets and roommates, update eligible carpool preferences and approve relevant room changes. Imports, travel details, tickets and room requests are trip-scoped and server-authorized. Room consent is applied atomically against a versioned composition. Ticket files are stored in private Vercel Blob and streamed only after a membership check. Application startup never applies migrations. GitHub Actions applies pending migrations to production or the `dev` Preview branch using the matching Vercel environment variables before asking Vercel to build and publish the tested commit. Feature previews do not run migrations.

Live use requires separate environment variables, a migrated database, a provisioned manager, a verified Brevo sender/domain, and the private Blob store connected to the Vercel project. Review the remaining rooming consent lifecycle and ticket retention policy before the first live participant import.
