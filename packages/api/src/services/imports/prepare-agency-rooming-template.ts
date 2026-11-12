import type ExcelJS from "exceljs";
import type { AppDatabase } from "../../auth";
import {
  listAgencyExportRooms,
  listAgencyRoomingMembers,
} from "../../datamodel/agency-rooming.repository";
import { loadBoundedWorkbook } from "../../source-import";
import {
  type AgencyRoomSlot,
  agencyRoomingColumns,
  normalizeSheetHeader,
  readAgencyRoomSlots,
  setAgencyCell,
} from "./agency-rooming-sheet";

type ExportResult =
  | { ok: false; status: 409 | 422; error: string; errors?: unknown[] }
  | { ok: true; workbook: Uint8Array };

export async function prepareAgencyRoomingTemplate(
  database: AppDatabase,
  tripId: string,
  data: ArrayBuffer,
): Promise<ExportResult> {
  const parsed = await loadBoundedWorkbook(data);
  if (!parsed.ok)
    return {
      ok: false,
      status: 422,
      error: "invalid_rooming_template",
      errors: parsed.errors,
    };
  const workbook = parsed.value;
  const sheet = workbook.getWorksheet("SKI TRAIN HOTEL");
  if (!sheet)
    return { ok: false, status: 422, error: "agency_rooming_sheet_missing" };

  const columns = agencyRoomingColumns(sheet);
  const requiredHeaders = [
    "Nbre de pax",
    "NOMS",
    "Prénoms",
    "Catégorie",
    "Typologie de chambre",
    "N° de chambre",
    "non skieur (pas de forfait)",
    "LIEU DEPART TRAIN",
    "Régimes spéciaux",
    "Allergènes",
    "Téléphone",
    "Commentaires",
  ];
  if (
    requiredHeaders.some((header) => !columns.has(normalizeSheetHeader(header)))
  )
    return { ok: false, status: 422, error: "agency_rooming_headers_missing" };

  const roomColumn = columns.get(normalizeSheetHeader("Typologie de chambre"));
  const numberColumn = columns.get(normalizeSheetHeader("N° de chambre"));
  if (roomColumn === undefined || numberColumn === undefined)
    return { ok: false, status: 422, error: "agency_rooming_headers_missing" };

  const inventory = readAgencyRoomSlots(sheet, roomColumn, numberColumn);
  if (!inventory)
    return { ok: false, status: 422, error: "agency_room_capacity_mismatch" };
  if (
    !inventory.length ||
    inventory.length > 100 ||
    inventory.reduce((total, room) => total + room.rows.length, 0) > 500
  )
    return { ok: false, status: 422, error: "agency_room_inventory_missing" };

  const rooms = await listAgencyExportRooms(database, tripId);
  if (rooms.length === 0)
    return { ok: false, status: 409, error: "agency_room_plan_missing" };

  const roomsByCapacity = new Map<number, typeof rooms>();
  rooms.sort((left, right) =>
    left.name.localeCompare(right.name, "fr", { numeric: true }),
  );
  for (const room of rooms) {
    const sameCapacity = roomsByCapacity.get(room.capacity) ?? [];
    sameCapacity.push(room);
    roomsByCapacity.set(room.capacity, sameCapacity);
  }

  const matchedRooms = inventory.map((slot) => ({
    slot,
    room: roomsByCapacity.get(slot.capacity)?.shift(),
  }));
  if ([...roomsByCapacity.values()].some((remaining) => remaining.length > 0))
    return { ok: false, status: 409, error: "agency_room_inventory_mismatch" };

  const { members, phoneByUser } = await listAgencyRoomingMembers(
    database,
    tripId,
  );
  const assignedByRoom = new Map<string, (typeof members)[number][]>();
  for (const member of members) {
    if (!member.roomId) continue;
    const roomMembers = assignedByRoom.get(member.roomId) ?? [];
    roomMembers.push(member);
    assignedByRoom.set(member.roomId, roomMembers);
  }

  for (const { slot, room } of matchedRooms) {
    const occupants = room ? (assignedByRoom.get(room.id) ?? []) : [];
    if (occupants.length > slot.capacity || slot.rows.length !== slot.capacity)
      return { ok: false, status: 409, error: "agency_room_capacity_mismatch" };
    clearAgencyRoomRows(sheet, columns, slot);
    writeAgencyRoomOccupants(sheet, columns, slot, occupants, phoneByUser);
  }

  return {
    ok: true,
    workbook: new Uint8Array(await workbook.xlsx.writeBuffer()),
  };
}

function clearAgencyRoomRows(
  sheet: ExcelJS.Worksheet,
  columns: Map<string, number>,
  room: AgencyRoomSlot,
) {
  for (const rowNumber of room.rows) {
    const row = sheet.getRow(rowNumber);
    for (const field of [
      "Nbre de pax",
      "NOMS",
      "Prénoms",
      "Catégorie",
      "non skieur (pas de forfait)",
      "LIEU DEPART TRAIN",
      "Régimes spéciaux",
      "Allergènes",
      "Téléphone",
    ])
      setAgencyCell(row, columns, field, "");
  }
}

function writeAgencyRoomOccupants(
  sheet: ExcelJS.Worksheet,
  columns: Map<string, number>,
  room: AgencyRoomSlot,
  occupants: Awaited<ReturnType<typeof listAgencyRoomingMembers>>["members"],
  phoneByUser: Map<string, string>,
) {
  const countRow = room.rows[0];
  if (countRow !== undefined)
    setAgencyCell(
      sheet.getRow(countRow),
      columns,
      "Nbre de pax",
      occupants.length,
    );

  occupants.forEach((person, index) => {
    const rowNumber = room.rows[index];
    if (rowNumber === undefined) return;
    const row = sheet.getRow(rowNumber);
    setAgencyCell(row, columns, "NOMS", person.lastName);
    setAgencyCell(row, columns, "Prénoms", person.firstName);
    setAgencyCell(row, columns, "Catégorie", "adulte");
    setAgencyCell(
      row,
      columns,
      "non skieur (pas de forfait)",
      person.activityProfile === "ski"
        ? "skieur (forfait)"
        : person.activityProfile === "spa"
          ? "non skieur (pas de forfait)"
          : "",
    );
    setAgencyCell(
      row,
      columns,
      "LIEU DEPART TRAIN",
      person.departureCity ?? "Sans",
    );
    setAgencyCell(
      row,
      columns,
      "Régimes spéciaux",
      person.dietaryRequirements ?? "",
    );
    setAgencyCell(row, columns, "Allergènes", person.allergens ?? "");
    setAgencyCell(
      row,
      columns,
      "Téléphone",
      phoneByUser.get(person.userId) ?? "",
    );

    const commentsColumn = columns.get(normalizeSheetHeader("Commentaires"));
    const currentComments = commentsColumn
      ? row.getCell(commentsColumn).text.trim()
      : "";
    if (
      person.skiDayThree &&
      !currentComments.toLocaleLowerCase("fr").includes("3e jour de ski")
    )
      setAgencyCell(
        row,
        columns,
        "Commentaires",
        [currentComments, "3e jour de ski"].filter(Boolean).join(" · "),
      );
  });
}
