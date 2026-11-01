import {
  addError,
  cellText,
  complete,
  failed,
  loadBoundedWorkbook,
  maxRows,
  normalizeHeader,
  normalizePersonName,
} from "./shared";
import type { AgencyRoomingRow, ImportError } from "./types";

export async function parseAgencyRooming(data: ArrayBuffer) {
  const workbook = await loadBoundedWorkbook(data);
  if (!workbook.ok) return workbook;
  const sheet = workbook.value.getWorksheet("SKI TRAIN HOTEL");
  if (!sheet) return failed("La feuille « SKI TRAIN HOTEL » est obligatoire.");
  const headerCells = sheet.getRow(1).values as unknown[];
  const headers = new Map<string, number>();
  for (let column = 1; column < headerCells.length; column += 1) {
    const header = normalizeHeader(String(headerCells[column] ?? ""));
    if (header) headers.set(header, column);
  }
  const column = (...names: string[]) => {
    for (const name of names) {
      const found = headers.get(normalizeHeader(name));
      if (found) return found;
    }
    return 0;
  };
  const firstNameColumn = column("Prénoms", "Prenoms", "Prénom", "Prenom");
  const lastNameColumn = column("NOMS", "Noms", "Nom");
  const outboundSeatColumn = column("Placement train Aller");
  const returnSeatColumn = column("Placement train Retour");
  const required = [
    [firstNameColumn, "Prénoms"],
    [lastNameColumn, "NOMS"],
    [outboundSeatColumn, "Placement train Aller"],
    [returnSeatColumn, "Placement train Retour"],
  ] as const;
  const missing = required.filter(([index]) => index === 0);
  if (missing.length)
    return failed(
      `Colonne(s) absente(s) : ${missing.map(([, name]) => name).join(", ")}.`,
    );
  const rows: AgencyRoomingRow[] = [];
  const errors: ImportError[] = [];
  const seenNames = new Map<string, number>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const firstName = cellText(row.getCell(firstNameColumn));
    const lastName = cellText(row.getCell(lastNameColumn));
    const outboundSeat = cellText(row.getCell(outboundSeatColumn)) || null;
    const returnSeat = cellText(row.getCell(returnSeatColumn)) || null;
    if (!firstName && !lastName && !outboundSeat && !returnSeat) return;
    if (!firstName || !lastName) {
      addError(
        errors,
        rowNumber,
        "NOMS / Prénoms",
        "Nom et prénom requis pour une ligne avec placement.",
      );
      return;
    }
    const key = normalizePersonName(firstName, lastName);
    if (seenNames.has(key)) {
      addError(
        errors,
        rowNumber,
        "NOMS / Prénoms",
        `Personne en double (ligne ${seenNames.get(key)}).`,
      );
      return;
    }
    seenNames.set(key, rowNumber);
    rows.push({
      row: rowNumber,
      firstName,
      lastName,
      outboundSeat,
      returnSeat,
    });
    if (rows.length > maxRows && errors.length === 0)
      addError(
        errors,
        rowNumber,
        "Fichier",
        `Le fichier dépasse la limite de ${maxRows} voyageurs.`,
      );
  });
  return complete(rows, errors, "Aucun placement de voyageur trouvé.");
}
