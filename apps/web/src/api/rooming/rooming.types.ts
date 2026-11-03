export type RoomSummary = {
  id: string;
  name: string;
  capacity: number;
  occupiedCount: number;
  genderPolicy: "single_gender" | "mixed" | "unset";
  isLocked: boolean;
  occupants: {
    userId: string;
    firstName: string;
    lastName: string;
    gender: "M" | "F" | null;
  }[];
};

export type RoomRequestSummary = {
  id: string;
  requesterUserId: string;
  status:
    | "pending"
    | "applied"
    | "rejected"
    | "cancelled"
    | "expired"
    | "stale";
  expiresAt: string;
  requester?: { firstName: string; lastName: string };
  requiredConsents: {
    userId: string;
    firstName?: string;
    lastName?: string;
    approved: boolean;
  }[];
  moves: {
    userId: string;
    person?: { firstName: string; lastName: string };
    currentRoom?: string | null;
    targetRoom?: string;
  }[];
};

export type RoomHistoryEntry = {
  id: string;
  actionType:
    | "traveler_request"
    | "organizer_move"
    | "plan_generation"
    | "plan_reset"
    | "roster_import";
  actorName: string;
  createdAt: string;
  changes: {
    userId: string;
    personName: string;
    fromRoom: string | null;
    toRoom: string | null;
  }[];
};

export type RoomAssignmentPlan = {
  snapshot: string;
  roomsToCreate: { id: string; name: string; capacity: number }[];
  assignments: {
    userId: string;
    firstName: string;
    lastName: string;
    gender: "M" | "F";
    roomId: string;
    roomName: string;
  }[];
  unassignedConfirmed: number;
  unconfirmed: number;
};

export type RoomInventoryItem = { capacity: number; quantity: number };
