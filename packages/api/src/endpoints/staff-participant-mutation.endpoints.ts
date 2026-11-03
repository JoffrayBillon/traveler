import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { AuthServices } from "../auth";
import { refreshRoomComposition } from "../datamodel/traveler.repository";
import * as schema from "../schema";
import { getSession } from "../services/auth/get-session";
import { saveParticipantFromOrganizer } from "../services/participant-editor-service";
import { updateParticipantRole } from "../services/participant-management";

export function registerStaffParticipantMutationEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.put(
    "/api/trips/:tripId/participants/:userId/admin-profile",
    async (context) => {
      context.header("Cache-Control", "no-store");
      const services = getAuthServices();
      if (!services) return context.json({ error: "service_unavailable" }, 503);
      const session = await getSession(services, context.req.raw.headers);
      if (!session) return context.json({ error: "unauthorized" }, 401);

      let payload: unknown;
      try {
        payload = await context.req.json();
      } catch {
        return context.json({ error: "invalid_participant_editor_input" }, 400);
      }

      const result = await saveParticipantFromOrganizer(
        services.database,
        context.req.param("tripId"),
        context.req.param("userId"),
        session.user.id,
        payload,
      );
      if ("error" in result) {
        const status =
          result.error === "not_found"
            ? 404
            : result.error === "forbidden"
              ? 403
              : result.error === "email_in_use" ||
                  result.error === "last_manager_required" ||
                  result.error === "cannot_change_own_role" ||
                  result.error === "transport_group_not_found"
                ? 409
                : result.error === "participant_update_failed"
                  ? 500
                  : 400;
        return context.json({ error: result.error }, status);
      }
      return context.json(result);
    },
  );

  app.patch(
    "/api/trips/:tripId/participants/:userId/activity",
    async (context) => {
      context.header("Cache-Control", "no-store");
      const services = getAuthServices();
      if (!services) return context.json({ error: "service_unavailable" }, 503);
      const session = await getSession(services, context.req.raw.headers);
      if (!session) return context.json({ error: "unauthorized" }, 401);
      const tripId = context.req.param("tripId");
      const userId = context.req.param("userId");
      const [actor] = await services.database
        .select({ role: schema.tripMemberships.role })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!actor) return context.json({ error: "not_found" }, 404);
      if (actor.role === "traveler")
        return context.json({ error: "forbidden" }, 403);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "invalid_activity" }, 400);
      }
      const input =
        body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>)
          : {};
      const activityProfile = input.activityProfile;
      const skiDayThree = input.skiDayThree;
      if (
        (activityProfile !== null &&
          activityProfile !== "ski" &&
          activityProfile !== "spa") ||
        typeof skiDayThree !== "boolean" ||
        (skiDayThree && activityProfile !== "ski")
      )
        return context.json({ error: "invalid_activity" }, 400);
      const [target] = await services.database
        .select({ userId: schema.tripMemberships.userId })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, userId),
          ),
        )
        .limit(1);
      if (!target) return context.json({ error: "not_found" }, 404);
      await services.database
        .insert(schema.travelerDetails)
        .values({ tripId, userId, activityProfile, skiDayThree })
        .onConflictDoUpdate({
          target: [
            schema.travelerDetails.tripId,
            schema.travelerDetails.userId,
          ],
          set: { activityProfile, skiDayThree, updatedAt: new Date() },
        });
      return context.json({ status: "saved" });
    },
  );

  app.put("/api/trips/:tripId/participants/:userId/role", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const userId = context.req.param("userId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_role" }, 400);
    }
    const role =
      body && typeof body === "object" && "role" in body
        ? (body as { role?: unknown }).role
        : undefined;
    if (role !== "traveler" && role !== "companion" && role !== "manager")
      return context.json({ error: "invalid_role" }, 400);
    if (userId === session.user.id)
      return context.json({ error: "cannot_change_own_role" }, 409);
    const roleUpdate = await updateParticipantRole(
      services.database,
      tripId,
      userId,
      role,
    );
    if (roleUpdate === "not_found")
      return context.json({ error: "not_found" }, 404);
    if (roleUpdate === "last_manager_required")
      return context.json({ error: roleUpdate }, 409);
    return context.json({ status: "updated", role });
  });

  app.put(
    "/api/trips/:tripId/participants/:userId/profile",
    async (context) => {
      context.header("Cache-Control", "no-store");
      const services = getAuthServices();
      if (!services) return context.json({ error: "service_unavailable" }, 503);
      const session = await getSession(services, context.req.raw.headers);
      if (!session) return context.json({ error: "unauthorized" }, 401);
      const tripId = context.req.param("tripId");
      const userId = context.req.param("userId");
      const [actor] = await services.database
        .select({ role: schema.tripMemberships.role })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!actor) return context.json({ error: "not_found" }, 404);
      if (actor.role === "traveler")
        return context.json({ error: "forbidden" }, 403);
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "invalid_profile" }, 400);
      }
      const input =
        body && typeof body === "object"
          ? (body as Record<string, unknown>)
          : {};
      const firstName =
        typeof input.firstName === "string" ? input.firstName.trim() : "";
      const lastName =
        typeof input.lastName === "string" ? input.lastName.trim() : "";
      const gender = input.gender;
      const dietaryRequirements =
        typeof input.dietaryRequirements === "string"
          ? input.dietaryRequirements.trim()
          : "";
      const allergens =
        typeof input.allergens === "string" ? input.allergens.trim() : "";
      const emergencyContactFirstName =
        typeof input.emergencyContactFirstName === "string"
          ? input.emergencyContactFirstName.trim()
          : "";
      const emergencyContactLastName =
        typeof input.emergencyContactLastName === "string"
          ? input.emergencyContactLastName.trim()
          : "";
      const emergencyContactPhone =
        typeof input.emergencyContactPhone === "string"
          ? input.emergencyContactPhone.trim()
          : "";
      const hasEmergencyContact = Boolean(
        emergencyContactFirstName ||
          emergencyContactLastName ||
          emergencyContactPhone,
      );
      const parsedPhone = emergencyContactPhone
        ? parsePhoneNumberFromString(emergencyContactPhone)
        : undefined;
      if (
        firstName.length < 1 ||
        firstName.length > 100 ||
        lastName.length < 1 ||
        lastName.length > 100 ||
        (gender !== null && gender !== "M" && gender !== "F") ||
        dietaryRequirements.length > 500 ||
        allergens.length > 500 ||
        emergencyContactFirstName.length > 100 ||
        emergencyContactLastName.length > 100 ||
        emergencyContactPhone.length > 40 ||
        (hasEmergencyContact &&
          (!emergencyContactFirstName ||
            !emergencyContactLastName ||
            !parsedPhone?.isValid()))
      )
        return context.json({ error: "invalid_profile" }, 400);
      const [target] = await services.database
        .select({
          gender: schema.tripMemberships.gender,
          roomId: schema.roomAssignments.roomId,
        })
        .from(schema.tripMemberships)
        .leftJoin(
          schema.roomAssignments,
          and(
            eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
            eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
          ),
        )
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, userId),
          ),
        )
        .limit(1);
      if (!target) return context.json({ error: "not_found" }, 404);
      const now = new Date();
      const emergencyContactIsComplete = Boolean(
        emergencyContactFirstName &&
          emergencyContactLastName &&
          parsedPhone?.isValid(),
      );
      await services.database.transaction(async (transaction) => {
        await transaction
          .update(schema.tripMemberships)
          .set({
            firstName,
            lastName,
            gender,
            genderConfirmed: gender !== null,
          })
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              eq(schema.tripMemberships.userId, userId),
            ),
          );
        await transaction
          .insert(schema.travelerProfiles)
          .values({
            tripId,
            userId,
            firstName,
            lastName,
            dietaryRequirements,
            allergens,
            emergencyContactFirstName,
            emergencyContactLastName,
            emergencyContactPhone: parsedPhone?.number ?? "",
            completedAt:
              gender !== null && emergencyContactIsComplete ? now : null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              schema.travelerProfiles.tripId,
              schema.travelerProfiles.userId,
            ],
            set: {
              firstName,
              lastName,
              dietaryRequirements,
              allergens,
              emergencyContactFirstName,
              emergencyContactLastName,
              emergencyContactPhone: parsedPhone?.number ?? "",
              completedAt:
                gender !== null && emergencyContactIsComplete ? now : null,
              updatedAt: now,
            },
          });
        if (target.roomId && target.gender !== gender)
          await refreshRoomComposition(transaction, tripId, target.roomId);
      });
      return context.json({ status: "saved" });
    },
  );
}
