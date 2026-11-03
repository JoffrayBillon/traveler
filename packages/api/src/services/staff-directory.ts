import type { AppDatabase } from "../auth";
import {
  listParticipantAccessRows,
  listTripTravelerRows,
  listValidatedRegistrationPayments,
} from "../datamodel/staff-directory.repository";

export async function listStaffTravelers(
  database: AppDatabase,
  tripId: string,
  actorRole: "companion" | "manager",
) {
  const [travelers, registrations] = await Promise.all([
    listTripTravelerRows(database, tripId),
    listValidatedRegistrationPayments(database, tripId),
  ]);
  const paymentsByUser = indexPayments(registrations);

  return travelers.map((person) => {
    const paymentItems = paymentsByUser.get(person.userId) ?? [];
    const payment = paymentItems.length === 1 ? paymentItems[0] : null;
    return {
      ...person,
      paymentStatus:
        actorRole === "manager" ? (payment?.paymentStatus ?? null) : null,
      amountPaidMinor:
        actorRole === "manager" ? (payment?.amountPaidMinor ?? null) : null,
      amountDueMinor:
        actorRole === "manager" ? (payment?.amountDueMinor ?? null) : null,
      paymentNeedsReview: actorRole === "manager" && paymentItems.length > 1,
    };
  });
}

export async function listParticipantAccess(
  database: AppDatabase,
  tripId: string,
) {
  const [travelers, registrations] = await Promise.all([
    listParticipantAccessRows(database, tripId),
    listValidatedRegistrationPayments(database, tripId),
  ]);
  const paymentsByUser = indexPayments(registrations);

  return travelers.map((person) => {
    const paymentItems = paymentsByUser.get(person.userId) ?? [];
    const payment = paymentItems.length === 1 ? paymentItems[0] : null;
    return {
      userId: person.userId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      role: person.role,
      lastLoginAt: person.lastLoginAt,
      paymentStatus: payment?.paymentStatus ?? null,
      amountPaidMinor: payment?.amountPaidMinor ?? null,
      amountDueMinor: payment?.amountDueMinor ?? null,
      paymentNeedsReview: paymentItems.length > 1,
    };
  });
}

function indexPayments<T extends { userId: string | null }>(items: T[]) {
  const byUser = new Map<string, T[]>();
  for (const item of items) {
    if (!item.userId) continue;
    const itemsForUser = byUser.get(item.userId) ?? [];
    itemsForUser.push(item);
    byUser.set(item.userId, itemsForUser);
  }
  return byUser;
}
