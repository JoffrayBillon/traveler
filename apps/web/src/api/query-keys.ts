export const queryKeys = {
  me: ["me"] as const,
  traveler: (tripId: string) => ["trips", tripId, "traveler"] as const,
  rooming: (tripId: string, organizerView?: boolean) =>
    organizerView === undefined
      ? (["trips", tripId, "rooming"] as const)
      : (["trips", tripId, "rooming", organizerView] as const),
  roomRequests: (tripId: string) => ["trips", tripId, "room-requests"] as const,
  roomInventory: (tripId: string) =>
    ["trips", tripId, "room-inventory"] as const,
  roomingHistory: (tripId: string) =>
    ["trips", tripId, "rooming-history"] as const,
  transport: (tripId: string) => ["trips", tripId, "transport"] as const,
  trainTickets: (tripId: string, segmentId?: string) =>
    segmentId === undefined
      ? (["trips", tripId, "train-tickets"] as const)
      : (["trips", tripId, "train-tickets", segmentId] as const),
  trainTicketImports: (tripId: string, segmentId: string) =>
    ["trips", tripId, "train-ticket-imports", segmentId] as const,
  participantDirectory: (tripId: string) =>
    ["trips", tripId, "participants"] as const,
} as const;
