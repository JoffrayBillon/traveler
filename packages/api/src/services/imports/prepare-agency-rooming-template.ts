import type ExcelJS from "exceljs";
import type { AppDatabase } from "../../auth";
import {
  ensureAgencyRoomInventory,
  listAgencyRoomingMembers,
} from "../../datamodel/agency-rooming.repository";
import { loadBoundedWorkbook } from "../../source-import";
import {
  agencyRoomingColumns,
  normalizeSheetHeader,
  roomCapacity,
  setAgencyCell,
} from "./agency-rooming-sheet";

type InventoryRoom = { name: string; capacity: number; rows: number[] };
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

  const inventoryByName = new Map<string, InventoryRoom>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const type = row.getCell(roomColumn).text.trim();
    const number = row.getCell(numberColumn).text.trim();
    if (!type || !number) return;
    const capacity = roomCapacity(type);
    if (!capacity) return;
    const name = `${type.toUpperCase()} ${number}`;
    const room = inventoryByName.get(name) ?? { name, capacity, rows: [] };
    room.rows.push(rowNumber);
    inventoryByName.set(name, room);
  });
  const inventory = [...inventoryByName.values()];
  if (
    !inventory.length ||
    inventory.length > 100 ||
    inventory.reduce((total, room) => total + room.rows.length, 0) > 500
  )
    return { ok: false, status: 422, error: "agency_room_inventory_missing" };

  const rooms = await ensureAgencyRoomInventory(
    database,
    tripId,
    inventory.map(({ name, capacity }) => ({ name, capacity })),
  );
  const roomByName = new Map(
    rooms.map((room) => [room.name.toUpperCase(), room]),
  );
  if (
    rooms.length !== inventory.length ||
    inventory.some(
      (room) =>
        roomByName.get(room.name.toUpperCase())?.capacity !== room.capacity,
    )
  )
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

  for (const room of inventory) {
    const dbRoom = roomByName.get(room.name.toUpperCase());
    const occupants = dbRoom ? (assignedByRoom.get(dbRoom.id) ?? []) : [];
    if (occupants.length > room.rows.length || room.rows.length < room.capacity)
      return { ok: false, status: 409, error: "agency_room_capacity_mismatch" };
    clearAgencyRoomRows(sheet, columns, room);
    writeAgencyRoomOccupants(sheet, columns, room, occupants, phoneByUser);
  }

  return {
    ok: true,
    workbook: new Uint8Array(await workbook.xlsx.writeBuffer()),
  };
}

function clearAgencyRoomRows(
  sheet: ExcelJS.Worksheet,
  columns: Map<string, number>,
  room: InventoryRoom,
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
  const firstRoomRow = room.rows[0];
  if (firstRoomRow !== undefined)
    setAgencyCell(sheet.getRow(firstRoomRow), columns, "Nbre de pax", "0");
}

function writeAgencyRoomOccupants(
  sheet: ExcelJS.Worksheet,
  columns: Map<string, number>,
  room: InventoryRoom,
  occupants: Awaited<ReturnType<typeof listAgencyRoomingMembers>>["members"],
  phoneByUser: Map<string, string>,
) {
  const countRow = room.rows[0];
  if (countRow !== undefined)
    setAgencyCell(
      sheet.getRow(countRow),
      columns,
      "Nbre de pax",
      String(occupants.length),
    );

  occupants.forEach((person, index) => {
    const rowNumber = room.rows[index];
    if (rowNumber === undefined) return;
    const row = sheet.getRow(rowNumber);
    setAgencyCell(row, columns, "NOMS", person.lastName);
    setAgencyCell(row, columns, "Prénoms", person.firstName);
    setAgencyCell(
      row,
      columns,
      "Catégorie",
      person.isVip
        ? "VIP"
        : person.role === "companion"
          ? "Accompagnateur"
          : (person.activityProfile ?? "").toUpperCase(),
    );
    setAgencyCell(
      row,
      columns,
      "non skieur (pas de forfait)",
      person.activityProfile === "spa" ? "Oui" : "Non",
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
