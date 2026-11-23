import { describe, expect, it } from "vitest";
import type { TrainTicketImportItem } from "./train-ticket-import.types";
import { previewTrainTicketImport } from "./train-ticket-import-preview";

function item(
  id: string,
  overrides: Partial<TrainTicketImportItem> = {},
): TrainTicketImportItem {
  return {
    id,
    pages: [1],
    kind: "transferable",
    carrier: "inoui",
    ticketNumber: id,
    reservation: "SHARED",
    serviceReference: null,
    carriage: "1",
    seat: id,
    firstName: null,
    lastName: null,
    capacity: null,
    issue: null,
    ...overrides,
  } satisfies TrainTicketImportItem;
}

const passengers = Array.from({ length: 72 }, (_, index) => ({
  userId: String(index + 1),
  roomId: String(index + 1),
  roomNumber: String(index + 1),
  firstName: "Camille",
  lastName: String(index + 1),
}));

describe("rail ticket import coverage", () => {
  it("counts unique travelers across a 40 + 31 deposit and confirmed collective coverage", () => {
    const documents = [
      {
        id: "first",
        originalName: "first.pdf",
        importItems: Array.from({ length: 40 }, (_, i) => item(String(i + 1))),
      },
      {
        id: "second",
        originalName: "second.pdf",
        importItems: Array.from({ length: 31 }, (_, i) => item(String(i + 41))),
      },
      {
        id: "collective",
        originalName: "collective.pdf",
        importItems: [item("collective", { kind: "collective", capacity: 1 })],
      },
    ];
    const draft = previewTrainTicketImport(passengers, [], documents);
    expect(draft.coverage).toMatchObject({
      expected: 72,
      ready: 71,
      missing: [{ id: "72" }],
    });
    expect(draft.documents[2]?.items[0]).toMatchObject({
      status: "review",
      issue: "collectiveUnconfirmed",
    });
    documents[2]?.importItems.push(item("repeat", { ticketNumber: "1" }));
    const collective = documents[2]?.importItems[0];
    if (!collective) throw new Error("missing fixture");
    collective.decision = { kind: "collective", capacity: 1, userIds: ["72"] };
    const confirmed = previewTrainTicketImport(passengers, [], documents);
    expect(confirmed.coverage).toMatchObject({
      expected: 72,
      ready: 72,
      missing: [],
    });
    expect(confirmed.documents[2]?.items[1]).toMatchObject({
      status: "review",
      issue: "duplicateTicket",
    });
  });

  it("assigns only a unique full nominative identity and ignores group names", () => {
    const people = [
      {
        userId: "a",
        roomId: "a",
        roomNumber: "01",
        firstName: "Camille",
        lastName: "Martin",
      },
      {
        userId: "b",
        roomId: "b",
        roomNumber: "02",
        firstName: "Maël",
        lastName: "Durand",
      },
    ];
    const result = previewTrainTicketImport(
      people,
      [],
      [
        {
          id: "mixed",
          originalName: "mixed.pdf",
          importItems: [
            item("1", { firstName: "Maël", lastName: "Durand" }),
            item("2", { kind: "named", firstName: "Mael", lastName: "Durand" }),
            item("3", {
              kind: "named",
              firstName: "Camille",
              lastName: "Martin",
              issue: "segmentMismatch",
            }),
          ],
        },
      ],
    );
    expect(
      result.documents[0]?.items.map((ticket) => [
        ticket.userIds,
        ticket.issue,
      ]),
    ).toEqual([
      [["a"], null],
      [["b"], null],
      [[], "segmentMismatch"],
    ]);
  });
});
