export type TripRole = "traveler" | "companion" | "manager";

export type TravelerProfile = {
  user: { id: string; name: string; email: string };
  trips: {
    tripId: string;
    tripName: string;
    endsOn?: string | null;
    role: TripRole;
  }[];
};
