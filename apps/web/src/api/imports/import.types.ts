export type ImportSourceType =
  | "validated_roster"
  | "detailed_orders"
  | "companions_vips"
  | "agency_rooming";

export type ImportPreview = {
  previewId: string;
  sourceType: ImportSourceType;
  summary: Record<string, number>;
  staffRows?: {
    row: number;
    firstName: string;
    lastName: string;
    email: string;
    proposedRole: "companion" | "traveler";
    isVip: boolean;
    existingRole: string | null;
    action: "create" | "update";
  }[];
  availableMembers?: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }[];
  agencyRows?: {
    row: number;
    firstName: string;
    lastName: string;
    outboundSeat: string | null;
    returnSeat: string | null;
    matchCount: number;
    previousOutboundSeat: string | null;
    previousReturnSeat: string | null;
  }[];
  changes?: {
    reference: string;
    action: string;
    fields: string[];
  }[];
};

export type ImportPreviewResponse = Partial<ImportPreview> & {
  errors?: { row: number; field: string; message: string }[];
};

export type ImportCommitResponse = {
  errors?: { row: number; field: string; message: string }[];
};
