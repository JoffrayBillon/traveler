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

export function setAgencyCell(
  row: ExcelJS.Row,
  columns: Map<string, number>,
  header: string,
  value: string,
) {
  const column = columns.get(normalizeSheetHeader(header));
  if (column) row.getCell(column).value = value;
}
