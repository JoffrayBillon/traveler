# Traveler — current product specification

This document combines the [original mission](MISSION_ORIGINAL.md) with the owner's decisions on 2026-10-26. It supersedes contradictory examples in the original. The application is for personally organized trips, starting with one ski trip of approximately 160 participants. Design trip ownership and membership for multiple trips; do not implement speculative travel products. Reassess provider plans if use becomes professional.

## Scope and roles

Identity is global; membership and role belong to a trip. A person can participate in several trips with different roles. Options, rooms, assignments, tickets and requests belong to one trip and cannot refer to another trip's members or resources.

| Role                         | Rights within that trip                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `traveler` — voyageur        | View own trip information, tickets, activity and assigned room/roommates; edit eligible carpool/parking preferences; participate in room exchange requests/consents. |
| `companion` — accompagnateur | Retain traveler view; process traveler requests; upload transport tickets and manage rooming within the trip.                                                        |
| `manager` — gestionnaire     | Retain companion capabilities; edit trip information and appoint companions.                                                                                         |

No public signup. Imported participants receive access using a passwordless email link and a secure persistent session. Importing an email does not establish email verification. Sign-in emails use the sender identity `BotMail <no-reply@joffraybillon.fr>`; verify the sender/domain in Brevo before the first live send. Define initial manager provisioning and recovery before implementing authentication. Participants do not directly edit activity, transport mode, tickets or room assignment. Later, ski day 3 and ski/spa formula changes can be requested and require administrative approval; these forms are outside the initial foundation.

## Rooms and requests

The ski trip has 29 rooms of four and 18 rooms of three: 47 rooms, 170 places, ten spare places if attendance is 160. Actual room identifiers/names are not provided and must not be invented as authoritative inventory. Capacity must be a positive integer and room names must be unique within a trip.

A room exchange requires agreement from the people exchanging their places. If a room changes from single-gender to mixed-gender, every person in the resulting room must approve. Apply capacity, membership, room policy and valid required approvals on the server in one atomic operation; an alert in the UI does not enforce the rule. The exchange must handle full rooms as a single operation rather than temporarily exceeding capacity.

Use a proposed change and a versioned composition to prevent applying approvals to a different proposal; this is an implementation safeguard, not a blanket consent to future roommates. This replaces the original global `mixedRoomConsent` algorithm: do not inherit its handling of already mixed rooms as an accepted rule. The exact role allowed to finalize an exchange, and whether administrative validation is mandatory after all participants agree, remain to be confirmed.

Still to decide before rooming implementation: changes into a vacancy without a swap; policy for membership changes in an already mixed room; withdrawal of consent after an assignment has been applied; consent expiry and notification policy; initial mixed-room consent collection and the source of real room names. Do not infer that one approval permanently authorizes later compositions.

## Activities and transport

Ski and spa profiles are mutually exclusive. Ski day 3 requires the skier profile. Modes are train, flight or none, with outbound/return legs. Store separate first and last names and complete dates, times/timezones, departure/meeting locations, transport reference and assigned seat where applicable. Staff may add tickets and details after initial import; missing details must be displayed clearly.

For no transport, booking/city fields are empty and carpool/parking controls become eligible. For train/flight, carpool/parking controls are ineligible and incompatible values must not remain active. Parking is a carpool sub-option in the original mission; confirm the exact implication and behavior when carpooling is unchecked before implementing it.

## Import/export and privacy

Import must validate the whole spreadsheet before writing, explain row-level failures, normalize addresses, detect duplicates and invalid room references, and apply the accepted batch atomically. Define retry/idempotency and correction behavior rather than assuming an upload can never be repeated. 160 is the expected ski attendance, not a hardcoded system-wide maximum. Validate spreadsheet formats, dates/times and size limits explicitly.

Rooming export includes room/capacity/status and occupants' first/last names, gender and email, ordered deterministically. The original template is not supplied; its layout must be provided or designed before exporter implementation. Real exports/imports never belong in the public repository.

Keep tickets in private storage with authorized server access, separate environments, sanitized logs, and an agreed retention/backup policy. Choose the storage provider before implementing ticket uploads. Accessibility includes React Aria controls, keyboard/touch alternatives to room drag-and-drop and real mobile verification; see the [guide](contributing/04-accessibility-rgaa.md).

## Current delivery boundary

The foundation includes tooling, local scripts, an accessible themed shell, API liveness and readiness endpoints, tests, CI/CD configuration and contributor/AI documentation. Operators can explicitly migrate the database, create/list trips, and provision a manager for a trip. Invite-only passwordless authentication uses Better Auth, persistent database-backed rate limits and 30-day sessions; the login form is accessible, enforces a 30-second retry cooldown, and its public acknowledgement does not disclose whether an email is a member. The server additionally limits each email to one magic-link request every 30 seconds and retains a five-per-minute client-IP abuse limit. `GET /api/me` returns only the signed-in user's trips and per-trip roles. Application startup never applies migrations. GitHub Actions applies pending migrations to production or the `dev` Preview branch using the matching Vercel environment variables before asking Vercel to build and publish the tested commit. Feature previews do not run migrations.

Participant imports, trip-specific activity and transport details, rooming, uploads, the management interface and request processing remain for later reviewed changes under the clarified contract above. Live login additionally requires separate environment variables, a migrated database, a provisioned manager, and a verified Brevo sender/domain.
