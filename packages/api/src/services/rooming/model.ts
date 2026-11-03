export type RoomMove = {
  userId: string;
  expectedRoomId: string | null;
  targetRoomId: string;
};

export type RoomChangePayload = {
  moves: RoomMove[];
  roomVersions: Record<string, number>;
};

export class RoomingError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "RoomingError";
  }
}
