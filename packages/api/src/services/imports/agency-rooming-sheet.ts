import type ExcelJS from "exceljs";

export function normalizeSheetHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr");
}

export function agencyRoomingColumns(sheet: ExcelJS.Worksheet) {
  const columns = new Map<string, number>();
  const headers = sheet.getRow(1).values as unknown[];
  for (let column = 1; column < headers.length; column += 1) {
    const value = normalizeSheetHeader(String(headers[column] ?? ""));
    if (value) columns.set(value, column);
  }
  return columns;
}

export function roomCapacity(roomType: string) {
  const normalized = roomType.toLocaleUpperCase("fr");
  if (normalized.includes("QUAD")) return 4;
  if (normalized.includes("TRIPLE")) return 3;
  const match = normalized.match(/\b(\d+)\s*(?:PAX|PLACES?)\b/);
  return match ? Number(match[1]) : null;
}

export function readAgencyRoomSlots(
  sheet: ExcelJS.Worksheet,
  typeColumn: number,
  numberColumn: number,
) {
  const beds: { row: number; type: string; capacity: number }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const type = normalizeSheetHeader(row.getCell(typeColumn).text);
    const capacity = roomCapacity(type);
    if (capacity) beds.push({ row: rowNumber, type, capacity });
  });

  const slots: AgencyRoomSlot[] = [];
  const identifiers = new Set<string>();
  const corrections: { row: number; sourceRow: number }[] = [];
  for (let index = 0; index < beds.length; ) {
    const first = beds[index];
    if (!first) break;
    const block = beds.slice(index, index + first.capacity);
    if (
      block.length !== first.capacity ||
      block.some(
        (bed, offset) =>
          bed.type !== first.type || bed.row !== first.row + offset,
      )
    )
      return null;

    const rows = block.map((bed) => bed.row);
    const numbers = rows.map((row) =>
      sheet.getRow(row).getCell(numberColumn).text.trim(),
    );
    const roomNumber = numbers.find(
      (number) =>
        number &&
        (numbers.every((value) => value === number) ||
          (numbers.length >= 3 &&
            numbers.filter((value) => value === number).length ===
              numbers.length - 1)),
    );
    if (!roomNumber) return null;
    const identifier = `${first.type}:${roomNumber}`;
    if (identifiers.has(identifier)) return null;
    identifiers.add(identifier);

    const sourceRow = rows[numbers.indexOf(roomNumber)];
    if (sourceRow === undefined) return null;
    for (const [offset, row] of rows.entries()) {
      if (numbers[offset] !== roomNumber) corrections.push({ row, sourceRow });
    }
    slots.push({ capacity: first.capacity, rows });
    index += first.capacity;
  }

  for (const { row, sourceRow } of corrections) {
    sheet.getRow(row).getCell(numberColumn).value = sheet
      .getRow(sourceRow)
      .getCell(numberColumn).value;
  }
  return slots;
}

export type AgencyRoomSlot = { capacity: number; rows: number[] };

export function setAgencyCell(
  row: ExcelJS.Row,
  columns: Map<string, number>,
  header: string,
  value: string | number,
) {
  const column = columns.get(normalizeSheetHeader(header));
  if (column) row.getCell(column).value = value;
}
