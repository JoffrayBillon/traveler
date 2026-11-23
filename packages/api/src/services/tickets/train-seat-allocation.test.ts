import { expect, it } from "vitest";
import { planTrainSeats } from "./train-seat-allocation";

const traveler = (userId: string, roomId: string, roomNumber: string) => ({
  userId,
  roomId,
  roomNumber,
  firstName: userId,
  lastName: "Traveler",
});

it("distributes consecutive seats in numerical room order", () => {
  const seats = ["12", "13", "14"].map((id) => ({
    id,
    userId: null,
    roomId: null,
  }));
  expect(
    planTrainSeats(
      seats,
      [
        traveler("C", "ten", "10"),
        traveler("B", "two", "2"),
        traveler("A", "two", "2"),
      ],
      true,
    ),
  ).toEqual([
    { id: "12", userId: "A", roomId: "two" },
    { id: "13", userId: "B", roomId: "two" },
    { id: "14", userId: "C", roomId: "ten" },
  ]);
});

it("reuses a seat only for another eligible occupant of its room", () => {
  const seats = [
    { id: "12", userId: "cancelled", roomId: "two" },
    { id: "13", userId: "B", roomId: "two" },
    { id: "14", userId: "C", roomId: "ten" },
    { id: "15", userId: null, roomId: null },
  ];
  const staying = [traveler("B", "two", "2"), traveler("C", "ten", "10")];
  expect(
    planTrainSeats(seats, [...staying, traveler("D", "ten", "10")], false),
  ).toEqual([{ id: "12", userId: null, roomId: "two" }]);
  expect(
    planTrainSeats(seats, [...staying, traveler("D", "two", "2")], false),
  ).toEqual([{ id: "12", userId: "D", roomId: "two" }]);
});

it("keeps a traveler's seat when they move to another room", () => {
  expect(
    planTrainSeats(
      [{ id: "12", userId: "A", roomId: "two" }],
      [traveler("A", "ten", "10")],
      false,
    ),
  ).toEqual([{ id: "12", userId: "A", roomId: "ten" }]);
});

it("never gives a canceled nominative ticket to another traveler", () => {
  expect(
    planTrainSeats(
      [{ id: "12", userId: "A", roomId: "two", allocation: "named" }],
      [traveler("B", "two", "2")],
      true,
    ),
  ).toEqual([{ id: "12", userId: null, roomId: null, allocation: "named" }]);
});
