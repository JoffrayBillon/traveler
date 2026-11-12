import type {
  AgencyRoomingRow,
  DetailedOrderRow,
  ImportError,
  StaffImportRow,
  ValidatedRosterRow,
} from "../../source-import";
import {
  parseAgencyRooming,
  parseCompanionsAndVips,
  parseDetailedOrders,
  parseValidatedRoster,
} from "../../source-import";

export type ParsedImportSource =
  | ({ sourceType: "agency_rooming" } & {
      rows: AgencyRoomingRow[];
      errors: ImportError[];
    })
  | ({ sourceType: "validated_roster" } & {
      rows: ValidatedRosterRow[];
      errors: ImportError[];
    })
  | ({ sourceType: "detailed_orders" } & {
      rows: DetailedOrderRow[];
      errors: ImportError[];
    })
  | ({ sourceType: "companions_vips" } & {
      rows: StaffImportRow[];
      errors: ImportError[];
    });

export const importSourceTypes = [
  "validated_roster",
  "detailed_orders",
  "companions_vips",
  "agency_rooming",
] as const;

export type ImportSourceType = (typeof importSourceTypes)[number];

export function isImportSourceType(value: unknown): value is ImportSourceType {
  return (
    typeof value === "string" &&
    importSourceTypes.includes(value as ImportSourceType)
  );
}

export async function parseImportSource(
  sourceType: ImportSourceType,
  data: ArrayBuffer,
): Promise<ParsedImportSource> {
  if (sourceType === "validated_roster") {
    return { sourceType, ...(await parseValidatedRoster(data)) };
  }
  if (sourceType === "detailed_orders") {
    return { sourceType, ...(await parseDetailedOrders(data)) };
  }
  if (sourceType === "agency_rooming") {
    return { sourceType, ...(await parseAgencyRooming(data)) };
  }
  return {
    sourceType: "companions_vips",
    ...(await parseCompanionsAndVips(data)),
  };
}
