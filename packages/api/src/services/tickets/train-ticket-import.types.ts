import type { TrainTicketCandidate } from "./analyze-train-ticket";

export type TrainTicketDecision = {
  kind: "named" | "transferable" | "collective" | "ignored";
  userIds?: string[] | undefined;
  ticketNumber?: string | undefined;
  carriage?: string | undefined;
  seat?: string | undefined;
  capacity?: number | undefined;
};

export type TrainTicketImportItem = TrainTicketCandidate & {
  id: string;
  decision?: TrainTicketDecision;
  published?: true;
};

export type TrainTicketImportDocument = {
  id: string;
  originalName: string;
  importItems: TrainTicketImportItem[];
};

export type TrainTicketImportIssue =
  | TrainTicketCandidate["issue"]
  | "duplicateTicket"
  | "travelerUnavailable"
  | "unassigned"
  | "collectiveUnconfirmed";
