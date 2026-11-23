import type {
  PdfPage,
  PdfTextBlock,
} from "../../adapters/pdf/ticket-pdf.adapter";

export type TrainTicketCandidate = {
  pages: number[];
  kind: "named" | "transferable" | "collective" | "auxiliary" | "review";
  carrier: "inoui" | "lyria" | "ouigo" | "trenitalia" | "ter" | null;
  ticketNumber: string | null;
  reservation: string | null;
  serviceReference: string | null;
  carriage: string | null;
  seat: string | null;
  firstName: string | null;
  lastName: string | null;
  capacity: number | null;
  issue: "segmentMismatch" | "multipleTickets" | "unrecognized" | null;
};

export type TrainTicketSegment = {
  serviceReference: string | null;
  origin: string;
  destination: string;
  departureAt: string | null;
};

type TicketFacts = {
  text: string;
  carrier: TrainTicketCandidate["carrier"];
  groupLayout: boolean;
  collectiveDocument: boolean;
  ticketNumbers: string[];
  reservation: string | null;
  serviceReference: string | null;
  carriage: string | null;
  seat: string | null;
  firstName: string | null;
  lastName: string | null;
  capacity: number | null;
  auxiliary: boolean;
  transferableMarker: boolean;
  hasTrainMarkers: boolean;
};

export function analyzeTrainTicket(
  pages: readonly PdfPage[],
  segment: TrainTicketSegment,
): TrainTicketCandidate[] {
  const candidates: TrainTicketCandidate[] = [];
  for (const page of pages) {
    const facts = readFacts(page.textBlocks);
    if (!page.hasVisibleContent && !facts.text.trim()) continue;

    if (facts.auxiliary) {
      candidates.push(
        candidate(page.pageNumber, facts, "auxiliary", null, false),
      );
      continue;
    }

    if (!facts.text.trim() || !facts.hasTrainMarkers) {
      candidates.push(
        candidate(page.pageNumber, facts, "review", "unrecognized", false),
      );
      continue;
    }

    const issue = getSegmentMismatch(facts, segment);
    const multipleTickets = facts.ticketNumbers.length > 1;
    if (
      (facts.collectiveDocument && !facts.seat) ||
      (facts.carrier === "trenitalia" && facts.groupLayout && !facts.seat)
    ) {
      candidates.push(
        candidate(
          page.pageNumber,
          facts,
          "collective",
          issue ?? (multipleTickets ? "multipleTickets" : null),
          true,
        ),
      );
      continue;
    }

    // A group ticket layout can print real or fictitious passenger names. The
    // names on these layouts are intentionally never returned to callers.
    const kind = facts.groupLayout
      ? facts.ticketNumbers.length || facts.seat
        ? "transferable"
        : "review"
      : facts.firstName && facts.lastName
        ? "named"
        : facts.transferableMarker
          ? "transferable"
          : "review";
    const resolvedIssue =
      issue ??
      (multipleTickets
        ? "multipleTickets"
        : kind === "review"
          ? "unrecognized"
          : null);
    candidates.push(
      candidate(page.pageNumber, facts, kind, resolvedIssue, facts.groupLayout),
    );
  }
  return candidates;
}

function candidate(
  pageNumber: number,
  facts: TicketFacts,
  kind: TrainTicketCandidate["kind"],
  issue: TrainTicketCandidate["issue"],
  suppressPassengerNames: boolean,
): TrainTicketCandidate {
  return {
    pages: [pageNumber],
    kind,
    carrier: facts.carrier,
    ticketNumber:
      facts.ticketNumbers.length === 1
        ? (facts.ticketNumbers[0] ?? null)
        : null,
    reservation: facts.reservation,
    serviceReference: facts.serviceReference,
    carriage: facts.carriage,
    seat: facts.seat,
    firstName: suppressPassengerNames ? null : facts.firstName,
    lastName: suppressPassengerNames ? null : facts.lastName,
    capacity: kind === "collective" ? facts.capacity : null,
    issue,
  };
}

function readFacts(blocks: readonly PdfTextBlock[]): TicketFacts {
  const text = blocks
    .slice()
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .map((block) => block.text)
    .join("\n");
  const normalized = normalize(text);
  const carrier = detectCarrier(normalized);
  const groupLayout =
    /\b(?:GROUPE|GROUP|GROUPO|GRUPPO)\b/.test(normalized) &&
    /\b(?:INOUI|LYRIA|TRENITALIA|OUIGO|TER)\b/.test(normalized);
  const collectiveDocument =
    /\b(?:BILLET|TITRE)\s+(?:DE\s+)?COLLECTIF\b|\bSANS\s+(?:BILLET|TICKET)\s+INDIVIDUEL\b/.test(
      normalized,
    );
  const auxiliary =
    /\b(?:LISTE DE PLACEMENT|LISTE DES PASSAGERS|PASSENGER LIST|PLACEMENT DES VOYAGEURS|ORDRE DE VOITURE)\b/.test(
      normalized,
    ) &&
    !/\b(?:E.?BILLET|BILLET ELECTRONIQUE|BOARDING PASS)\b/.test(normalized);
  const ticketNumbers = findTicketNumbers(text);
  const serviceReference = findServiceReference(text);
  const names = findPassengerNames(text);
  const sourceOrderSeat =
    carrier === "inoui" ? findSourceOrderSeat(blocks) : null;
  const normalizedCarriage = firstMatch(normalized, [
    /\b(?:VOITURE|COACH|CARROZZA)\s*(?:N[RO.]?\s*)?([A-Z]?\d{1,3})\b/,
  ]);
  const normalizedSeat = firstMatch(normalized, [
    /\b(?:PLACE|SEAT|SIEGE|POSTO)\s*(?:N[RO.]?\s*)?([A-Z]?\d{1,3}[A-Z]?)\b/,
  ]);
  return {
    text,
    carrier,
    groupLayout,
    collectiveDocument,
    ticketNumbers,
    reservation: findReservation(text),
    serviceReference,
    carriage: normalizedCarriage ?? sourceOrderSeat?.carriage ?? null,
    seat: normalizedSeat ?? sourceOrderSeat?.seat ?? null,
    firstName: names.firstName,
    lastName: names.lastName,
    capacity:
      (carrier === "trenitalia" ? findTrenitaliaGroupCapacity(blocks) : null) ??
      findCollectiveCapacity(text),
    auxiliary,
    transferableMarker: /\b(?:TRANSFERABLE|NON\s*NOMINATIF|NOT\s*NAMED)\b/.test(
      normalized,
    ),
    hasTrainMarkers:
      carrier !== null ||
      /\b(?:E.?BILLET|RAIL TICKET|TRAIN|TGV)\b/.test(normalized),
  };
}

function findSourceOrderSeat(blocks: readonly PdfTextBlock[]) {
  for (let index = 0; index < blocks.length; index += 1) {
    if (!/^VOITURE$/i.test(blocks[index]?.text.trim() ?? "")) continue;
    const direct = readSourceOrderSeatAt(blocks, index + 2, index + 6);
    if (direct) return direct;

    // Common Inoui source order: VOITURE, carriage number, PLACE, seat number.
    const window = blocks.slice(index + 1, index + 10);
    let carriage: string | null = null;
    let seatLabelIndex = -1;
    for (let offset = 0; offset < window.length; offset += 1) {
      const value = window[offset]?.text.trim() ?? "";
      if (/\b(?:PLACE|SIEGE|SEAT)\b/i.test(value)) {
        seatLabelIndex = offset;
        break;
      }
      carriage ??= readSingleShortNumber(value);
    }
    if (!carriage || seatLabelIndex < 0) continue;
    const seat = window
      .slice(seatLabelIndex + 1, seatLabelIndex + 4)
      .map((block) => readSingleShortNumber(block.text.trim()))
      .find(Boolean);
    if (seat) return { carriage, seat };
  }
  return null;
}

function readSourceOrderSeatAt(
  blocks: readonly PdfTextBlock[],
  carriageIndex: number,
  seatIndex: number,
) {
  const carriage = blocks[carriageIndex]?.text.trim();
  const seat = blocks[seatIndex]?.text.trim();
  const carriageMatch = carriage ? readSingleShortNumber(carriage) : null;
  const seatMatch = seat ? readSingleShortNumber(seat) : null;
  return carriageMatch && seatMatch
    ? { carriage: carriageMatch, seat: seatMatch }
    : null;
}

function readSingleShortNumber(value: string) {
  return value.match(/^\D*([A-Z]?\d{1,3}[A-Z]?)(?:\D*)$/i)?.[1] ?? null;
}

function detectCarrier(text: string): TicketFacts["carrier"] {
  if (/\b(?:TGV\s*)?INOUI\b/.test(text)) return "inoui";
  if (/\b(?:TGV\s*)?LYRIA\b/.test(text)) return "lyria";
  if (/\bOUIGO\b/.test(text)) return "ouigo";
  if (/\bTRENITALIA\b/.test(text)) return "trenitalia";
  if (/\bTER\b/.test(text)) return "ter";
  return null;
}

function findTicketNumbers(text: string): string[] {
  const numbers = new Set<string>();
  const patterns = [
    /(?:N[º°.]?\s*)?(?:E[- ]?BILLET|ELECTRONIC TICKET|NUMERO DE BILLET)[^\d]{0,40}(\d{8,14})/gi,
    /(?:BILLET|TICKET)\s*(?:(?:N[º°.]?\s*|#\s*)[:#-]?\s*)?(\d{8,14})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) numbers.add(match[1]);
    }
  }
  return [...numbers];
}

function findReservation(text: string): string | null {
  return firstMatch(text, [
    /\b(?:BOOKING|RESERVATION|RESERVATION CODE|DOSSIER|PNR)\s*(?:N[º°.]?\s*)?[:#-]?\s*([A-Z0-9]{5,10})\b/i,
  ]);
}

function findServiceReference(text: string): string | null {
  return firstMatch(text, [
    /\b(?:TRAIN|TGV|TRAIN NUMBER|NUMERO DE TRAIN|N[º°.]? DE TRAIN)\s*[:#-]?\s*(\d{3,6})\b/i,
  ]);
}

function findPassengerNames(text: string) {
  const match = text.match(
    /\b(?:PASSAGER|PASSENGER|TITULAIRE)\s*[:\n-]*\s*(?:NOM\s*[:\n-]*\s*)?([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’ -]{1,50})\s*(?:,|\n|\s{2,})\s*(?:PR[EÉ]NOM|FIRST NAME)\s*[:\n-]*\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’ -]{1,40})/i,
  );
  if (match?.[1] && match[2])
    return { lastName: match[1].trim(), firstName: match[2].trim() };

  const labelled = text.match(
    /\bNOM\s*[:\n-]+\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’ -]{1,40})\s*(?:,|\n|\s{2,})\s*PR[EÉ]NOM\s*[:\n-]+\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’ -]{1,40})/i,
  );
  return labelled?.[1] && labelled[2]
    ? { lastName: labelled[1].trim(), firstName: labelled[2].trim() }
    : { firstName: null, lastName: null };
}

function findCollectiveCapacity(text: string): number | null {
  const counts = new Set<number>();
  for (const match of text.matchAll(
    /(?:\b(?:ADULTS?|ADULTI|ADULTO|ADULTES)\s*[:=-]?\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:ADULTS?|ADULTI|ADULTO|ADULTES)\b)/gi,
  )) {
    const count = Number(match[1] ?? match[2]);
    if (count > 0) counts.add(count);
  }
  const explicitCapacity = text.match(
    /\bCAPACIT[EÉ]\s*[:=-]?\s*(\d{1,3})\b/i,
  )?.[1];
  if (explicitCapacity) return Number(explicitCapacity);
  return counts.size > 0
    ? [...counts].reduce((total, count) => total + count, 0)
    : null;
}

function findTrenitaliaGroupCapacity(blocks: readonly PdfTextBlock[]) {
  const adults = blocks.find(({ text }) =>
    /^(?:ADULTES|ADULTI|ADULTS)$/.test(normalize(text).trim()),
  );
  if (!adults) return null;
  const children = blocks.find(
    ({ text, y, x }) =>
      x > adults.x &&
      Math.abs(y - adults.y) <= 5 &&
      /^(?:ENFANTS|BAMBINI|CHILDREN)$/.test(normalize(text).trim()),
  );
  if (!children) return null;
  const rows = blocks.filter(
    ({ text, x, y }) =>
      x < adults.x &&
      y > adults.y &&
      y - adults.y <= 180 &&
      /^(?:GROUP|GROUPE|GRUPPO)\b/.test(normalize(text).trim()),
  );
  let total = 0;
  for (const row of rows) {
    for (const column of [adults, children]) {
      const values = blocks.filter(
        ({ text, x, y }) =>
          /^\d{1,3}$/.test(text.trim()) &&
          Math.abs(y - row.y) <= 5 &&
          x >= column.x - 5 &&
          x <= column.x + column.width + 5,
      );
      if (values.length !== 1) return null;
      total += Number(values[0]?.text);
    }
  }
  return total > 0 && total <= 500 ? total : null;
}

function getSegmentMismatch(
  facts: TicketFacts,
  segment: TrainTicketSegment,
): TrainTicketCandidate["issue"] {
  if (
    facts.serviceReference &&
    segment.serviceReference &&
    normalize(facts.serviceReference) !== normalize(segment.serviceReference)
  )
    return "segmentMismatch";

  const from = findRouteValue(facts.text, "from");
  const to = findRouteValue(facts.text, "to");
  if (from && segment.origin && !stationMatches(from, segment.origin))
    return "segmentMismatch";
  if (to && segment.destination && !stationMatches(to, segment.destination))
    return "segmentMismatch";

  const ticketDate = findDepartureDate(facts.text);
  const segmentDate = segment.departureAt?.slice(0, 10);
  if (ticketDate && segmentDate && ticketDate !== segmentDate)
    return "segmentMismatch";
  return null;
}

function findRouteValue(text: string, direction: "from" | "to"): string | null {
  const pattern =
    direction === "from"
      ? /\b(?:DEPART|DEPARTURE|ORIGINE|FROM)\s*[:\n-]+\s*([^\n,;]{2,60})/i
      : /\b(?:ARRIV[EÉ]E|ARRIVAL|DESTINATION|TO)\s*[:\n-]+\s*([^\n,;]{2,60})/i;
  return text.match(pattern)?.[1]?.trim() ?? null;
}

function findDepartureDate(text: string): string | null {
  const raw = text.match(
    /\b(?:DATE|DEPARTURE DATE|DATE DE DEPART)\s*[:\n-]+\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  )?.[1];
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [day, month, year] = raw.split(/[./-]/).map(Number);
  if (!day || !month || !year) return null;
  return `${year < 100 ? 2000 + year : year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function stationMatches(actual: string, expected: string) {
  const actualName = normalize(actual);
  const expectedName = normalize(expected);
  return (
    actualName === expectedName ||
    actualName.includes(expectedName) ||
    expectedName.includes(actualName)
  );
}

function firstMatch(text: string, patterns: readonly RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) return match;
  }
  return null;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}
