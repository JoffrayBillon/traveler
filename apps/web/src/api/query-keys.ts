export const queryKeys = {
  me: ["me"] as const,
  traveler: (tripId: string) => ["trips", tripId, "traveler"] as const,
  rooming: (tripId: string, includeTravelers?: boolean) =>
    includeTravelers === undefined
      ? (["trips", tripId, "rooming"] as const)
      : (["trips", tripId, "rooming", includeTravelers] as const),
  roomInventory: (tripId: string) =>
    ["trips", tripId, "room-inventory"] as const,
  transport: (tripId: string) => ["trips", tripId, "transport"] as const,
  participantDirectory: (tripId: string) =>
    ["trips", tripId, "participants"] as const,
} as const;
