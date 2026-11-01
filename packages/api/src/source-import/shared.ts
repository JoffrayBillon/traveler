import ExcelJS from "exceljs";
import type { ImportError, ParseResult } from "./types";

export const maxRows = 500;
export function normalizePersonName(firstName: string, lastName: string) {
  return `${normalizeName(lastName)}|${normalizeName(firstName)}`;
}

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr");
}

export function normalizeHeader(value: string) {
  return normalizeName(value.replace(/\n/g, " "));
}

export function readHeaders(sheet: ExcelJS.Worksheet, required: string[]) {
  const cells = sheet.getRow(1).values as unknown[];
  const index = new Map<string, number>();
  const errors: ImportError[] = [];
  for (let column = 1; column < cells.length; column += 1) {
    const header = String(cells[column] ?? "").trim();
    if (!header) continue;
    if (index.has(header)) addError(errors, 1, header, "Colonne en double.");
    else index.set(header, column);
  }
  for (const header of required) {
    if (!index.has(header))
      addError(errors, 1, header, `Colonne obligatoire absente : ${header}.`);
  }
  return errors.length
    ? { ok: false as const, errors, index }
    : { ok: true as const, index };
}

export function dataRows(
  sheet: ExcelJS.Worksheet,
  headers: Map<string, number>,
  keyHeaders: string[],
) {
  const keys = keyHeaders.map((header) => headers.get(header) ?? 0);
  const rows: number[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1 && keys.some((column) => cellText(row.getCell(column))))
      rows.push(rowNumber);
  });
  return rows;
}

export async function loadBoundedWorkbook(
  data: ArrayBuffer,
): Promise<
  | { ok: true; value: ExcelJS.Workbook }
  | { ok: false; rows: never[]; errors: ImportError[] }
> {
  if (!isBoundedZip(data))
    return {
      ok: false,
      rows: [],
      errors: [
        {
          row: 1,
          field: "Fichier",
          message:
            "Le classeur est invalide ou dépasse la taille décompressée autorisée.",
        },
      ],
    };
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
    return { ok: true, value: workbook };
  } catch {
    return {
      ok: false,
      rows: [],
      errors: [
        {
          row: 1,
          field: "Fichier",
          message: "Le classeur Excel est illisible.",
        },
      ],
    };
  }
}

export function isBoundedZip(data: ArrayBuffer) {
  const bytes = new DataView(data);
  if (bytes.byteLength < 22) return false;
  const searchStart = Math.max(0, bytes.byteLength - 65_557);
  let endOffset = -1;
  for (let offset = bytes.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (bytes.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) return false;
  const entryCount = bytes.getUint16(endOffset + 10, true);
  const directorySize = bytes.getUint32(endOffset + 12, true);
  const directoryOffset = bytes.getUint32(endOffset + 16, true);
  if (
    entryCount === 0 ||
    entryCount > 200 ||
    directoryOffset + directorySize > endOffset
  )
    return false;
  let offset = directoryOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > bytes.byteLength ||
      bytes.getUint32(offset, true) !== 0x02014b50
    )
      return false;
    const compressedSize = bytes.getUint32(offset + 20, true);
    const uncompressedSize = bytes.getUint32(offset + 24, true);
    const nameLength = bytes.getUint16(offset + 28, true);
    const extraLength = bytes.getUint16(offset + 30, true);
    const commentLength = bytes.getUint16(offset + 32, true);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff)
      return false;
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > 20 * 1024 * 1024) return false;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return offset <= directoryOffset + directorySize;
}

export function cellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (typeof value === "object" && value !== null && "richText" in value)
    return value.richText
      .map((part) => part.text)
      .join("")
      .trim();
  if (typeof value === "object" && value !== null && "result" in value)
    return String(value.result ?? "").trim();
  return String(cell.text ?? "").trim();
}

export function cellReference(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (typeof value === "number")
    return Number.isInteger(value) ? String(value) : "";
  return cellText(cell).replace(/\s+/g, "");
}

export function readMoney(cell: ExcelJS.Cell): number | null | false {
  if (cell.value === null || cell.value === undefined || cellText(cell) === "")
    return null;
  const raw =
    typeof cell.value === "number"
      ? cell.value
      : Number(
          cellText(cell).replace(/\s/g, "").replace(",", ".").replace(/€/g, ""),
        );
  if (!Number.isFinite(raw) || raw < 0) return false;
  return Math.round(raw * 100);
}

export function normalizePaymentStatus(
  value: string,
): "paid" | "partially_paid" | "unpaid" | null {
  if (value === "Payée") return "paid";
  if (value === "Payée partiellement") return "partially_paid";
  if (value === "Non payée") return "unpaid";
  return null;
}

export function derivePaymentStatus(
  amountPaidMinor: number | null,
  amountDueMinor: number | null,
): "paid" | "partially_paid" | "unpaid" | null {
  if (amountDueMinor === 0) return "paid";
  if (amountDueMinor !== null && amountDueMinor > 0) {
    return amountPaidMinor !== null && amountPaidMinor > 0
      ? "partially_paid"
      : "unpaid";
  }
  return null;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function addError(
  errors: ImportError[],
  row: number,
  field: string,
  message: string,
) {
  errors.push({ row, field, message });
}

export function failed<T = never>(message: string): ParseResult<T> {
  return { rows: [], errors: [{ row: 1, field: "Fichier", message }] };
}

export function complete<T>(
  rows: T[],
  errors: ImportError[],
  emptyMessage: string,
): ParseResult<T> {
  if (rows.length === 0 && errors.length === 0)
    addError(errors, 2, "Fichier", emptyMessage);
  if (
    rows.length > maxRows &&
    !errors.some((error) => error.field === "Fichier")
  )
    addError(
      errors,
      1,
      "Fichier",
      `Le fichier dépasse la limite de ${maxRows} lignes.`,
    );
  return errors.length ? { rows: [], errors } : { rows, errors };
}
