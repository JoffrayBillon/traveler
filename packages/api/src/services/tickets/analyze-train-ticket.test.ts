import { expect, it } from "vitest";
import type { PdfPage } from "../../adapters/pdf/ticket-pdf.adapter";
import {
  analyzeTrainTicket,
  type TrainTicketSegment,
} from "./analyze-train-ticket";

const segment: TrainTicketSegment = {
  serviceReference: "9876",
  origin: "Paris",
  destination: "Chambery",
  departureAt: "2027-03-01T08:00:00+01:00",
};

function page(
  pageNumber: number,
  text: string,
  hasVisibleContent = true,
): PdfPage {
  return {
    pageNumber,
    width: 400,
    height: 500,
    hasVisibleContent,
    textBlocks: text.split("\n").map((line, index) => ({
      text: line,
      x: 0,
      y: index * 12,
      width: line.length * 5,
      height: 10,
    })),
  };
}

it("classifies group-layout pages as transferable and always suppresses their printed names", () => {
  const result = analyzeTrainTicket(
    [
      page(
        2,
        "TGV INOUI GROUPE\nN° e-billet 123456789\nVoiture 12 - Place 34\nNom : Doe\nPrénom : Jane",
      ),
    ],
    segment,
  );

  expect(result).toEqual([
    expect.objectContaining({
      pages: [2],
      kind: "transferable",
      carrier: "inoui",
      ticketNumber: "123456789",
      carriage: "12",
      seat: "34",
      firstName: null,
      lastName: null,
      issue: null,
    }),
  ]);
});

it("does not expose a different printed name on any Lyria group page", () => {
  const result = analyzeTrainTicket(
    [
      page(
        1,
        "TGV LYRIA GROUPE\nE-billet 234567890\nNOM: Example\nPRÉNOM: Alice",
      ),
    ],
    segment,
  );
  expect(result[0]).toMatchObject({
    kind: "transferable",
    carrier: "lyria",
    firstName: null,
    lastName: null,
  });
});

it("recovers Inoui coach and seat labels from source item order", () => {
  const sourceOrderedPage: PdfPage = {
    pageNumber: 1,
    width: 400,
    height: 500,
    hasVisibleContent: true,
    textBlocks: [
      { text: "TGV INOUI", x: 0, y: 100, width: 50, height: 10 },
      { text: "TARIF GROUPE", x: 0, y: 110, width: 50, height: 10 },
      { text: "VOITURE", x: 0, y: 200, width: 50, height: 10 },
      { text: "12", x: 0, y: 10, width: 10, height: 10 },
      { text: "PLACE", x: 0, y: 180, width: 50, height: 10 },
      { text: "41", x: 0, y: 20, width: 10, height: 10 },
    ],
  };
  const result = analyzeTrainTicket([sourceOrderedPage], segment);
  expect(result[0]).toMatchObject({
    kind: "transferable",
    carriage: "12",
    seat: "41",
  });
});

it("reads labeled Inoui numbers when punctuation shares their source block", () => {
  const result = analyzeTrainTicket(
    [
      page(
        1,
        "TGV INOUI GROUPE\nE-billet 123456789\nVOITURE n° 12\nPLACE n° 41",
      ),
    ],
    segment,
  );
  expect(result[0]).toMatchObject({ carriage: "12", seat: "41" });
});

it("classifies an explicit passenger block as named outside group layouts", () => {
  const result = analyzeTrainTicket(
    [page(1, "TGV INOUI\nN° e-billet 123456789\nPASSAGER: DOE\nPRÉNOM: JANE")],
    segment,
  );
  expect(result[0]).toMatchObject({
    kind: "named",
    firstName: "JANE",
    lastName: "DOE",
    issue: null,
  });
});

it("sums explicit Trenitalia group adult counts once as collective capacity", () => {
  const result = analyzeTrainTicket(
    [
      page(
        1,
        "TRENITALIA\nGruppo adulti: 3\nGruppo adulti: 54\nBiglietto collettivo",
      ),
    ],
    segment,
  );
  expect(result[0]).toMatchObject({
    kind: "collective",
    carrier: "trenitalia",
    capacity: 57,
    issue: null,
  });
});

it("counts both numeric passenger columns under a Trenitalia group table", () => {
  const blocks: [text: string, x: number, y: number][] = [
    ["TRENITALIA", 15, 10],
    ["Adultes", 250, 100],
    ["Enfants", 310, 100],
    ["Group A", 25, 122],
    ["000000", 170, 122],
    ["3", 250, 122],
    ["0", 310, 122],
    ["Group B", 25, 143],
    ["111111", 170, 143],
    ["54", 250, 143],
    ["0", 310, 143],
    ["89", 250, 202],
  ];
  expect(
    analyzeTrainTicket(
      [
        {
          ...page(1, ""),
          textBlocks: blocks.map(([text, x, y]) => ({
            text,
            x,
            y,
            width: text.length * 5,
            height: 10,
          })),
        },
      ],
      segment,
    )[0],
  ).toMatchObject({ kind: "collective", capacity: 57 });
});

it("treats a non-separable explicitly collective TGV page as collective", () => {
  const result = analyzeTrainTicket(
    [
      page(
        1,
        "TGV LYRIA\nBILLET COLLECTIF\nTarif groupe adultes\nCapacité 57 voyageurs",
      ),
    ],
    segment,
  );
  expect(result[0]).toMatchObject({
    kind: "collective",
    carrier: "lyria",
    ticketNumber: null,
    seat: null,
  });
});

it("keeps segment conflicts visible and treats missing segment data as unknown", () => {
  const result = analyzeTrainTicket(
    [
      page(1, "TGV INOUI\nE-billet 123456789\nTrain: 2345"),
      page(2, "TGV INOUI\nE-billet 123456780"),
    ],
    segment,
  );
  expect(result[0]?.issue).toBe("segmentMismatch");
  expect(result[1]?.issue).not.toBe("segmentMismatch");
  expect(result[1]?.kind).toBe("review");
});

it("flags pages with multiple distinct tickets and ignores truly blank pages", () => {
  const result = analyzeTrainTicket(
    [
      page(1, "TGV INOUI\nE-billet 123456789\nTicket 223456789"),
      page(2, "", false),
    ],
    segment,
  );
  expect(result).toHaveLength(1);
  expect(result[0]?.issue).toBe("multipleTickets");
  expect(result[0]?.ticketNumber).toBeNull();
});

it("keeps unknown and non-text pages for manual review", () => {
  const unknown = analyzeTrainTicket(
    [page(7, "Unrecognized travel voucher")],
    segment,
  );
  const imageOnly = analyzeTrainTicket(
    [{ ...page(8, "", true), textBlocks: [] }],
    segment,
  );
  expect(unknown[0]).toMatchObject({
    kind: "review",
    issue: "unrecognized",
    pages: [7],
  });
  expect(imageOnly[0]).toMatchObject({
    kind: "review",
    issue: "unrecognized",
    pages: [8],
  });
});

it("recognizes auxiliary seat rosters as zero ticket documents", () => {
  const result = analyzeTrainTicket(
    [
      page(
        3,
        "Liste de placement des voyageurs\nVoiture 12 Place 34\nTRENITALIA",
      ),
    ],
    segment,
  );
  expect(result[0]).toMatchObject({
    kind: "auxiliary",
    carrier: "trenitalia",
    capacity: null,
  });
});
