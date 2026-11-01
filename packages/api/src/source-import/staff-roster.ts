import {
  addError,
  cellText,
  complete,
  dataRows,
  failed,
  isValidEmail,
  loadBoundedWorkbook,
  readHeaders,
} from "./shared";
import type { ImportError, StaffImportRow } from "./types";

export async function parseCompanionsAndVips(data: ArrayBuffer) {
  const workbook = await loadBoundedWorkbook(data);
  if (!workbook.ok) return workbook;
  const sheet = workbook.value.worksheets[0];
  if (!sheet) return failed("Le classeur ne contient aucune feuille.");
  const headers = readHeaders(sheet, [
    "Genre",
    "Prenom",
    "Nom",
    "Type",
    "Declinaison",
    "Supp 3j ski",
    "Transport",
    "Mail",
  ]);
  if (!headers.ok)
    return { rows: [] as StaffImportRow[], errors: headers.errors };
  const errors: ImportError[] = [];
  const rows: StaffImportRow[] = [];
  const emails = new Map<string, number>();
  for (const rowNumber of dataRows(sheet, headers.index, ["Mail"])) {
    const row = sheet.getRow(rowNumber);
    const firstName = cellText(row.getCell(headers.index.get("Prenom") ?? 0));
    const lastName = cellText(row.getCell(headers.index.get("Nom") ?? 0));
    const email = cellText(
      row.getCell(headers.index.get("Mail") ?? 0),
    ).toLowerCase();
    const rawGender = cellText(
      row.getCell(headers.index.get("Genre") ?? 0),
    ).toUpperCase();
    const rawType = cellText(row.getCell(headers.index.get("Type") ?? 0));
    const rawActivity = cellText(
      row.getCell(headers.index.get("Declinaison") ?? 0),
    ).toUpperCase();
    const rawDayThree = cellText(
      row.getCell(headers.index.get("Supp 3j ski") ?? 0),
    );
    const city = cellText(row.getCell(headers.index.get("Transport") ?? 0));
    const gender = rawGender === "H" ? "M" : rawGender === "F" ? "F" : null;
    const role =
      rawType === "Accompagnant"
        ? "companion"
        : rawType === "Partner"
          ? "traveler"
          : null;
    const activityProfile = rawActivity.includes("SPA")
      ? "spa"
      : rawActivity.includes("SKI")
        ? "ski"
        : null;
    const skiDayThree = rawDayThree === "+";

    if (!firstName)
      addError(errors, rowNumber, "Prenom", "Le prénom est obligatoire.");
    if (!lastName)
      addError(errors, rowNumber, "Nom", "Le nom est obligatoire.");
    if (!isValidEmail(email))
      addError(errors, rowNumber, "Mail", "L’adresse e-mail est invalide.");
    if (email && emails.has(email))
      addError(
        errors,
        rowNumber,
        "Mail",
        `Adresse déjà utilisée ligne ${emails.get(email)}.`,
      );
    else if (email) emails.set(email, rowNumber);
    if (!gender)
      addError(errors, rowNumber, "Genre", "Le sexe doit être H ou F.");
    if (!role)
      addError(
        errors,
        rowNumber,
        "Type",
        "Le type doit être Accompagnant ou Partner.",
      );
    if (!activityProfile)
      addError(
        errors,
        rowNumber,
        "Declinaison",
        "La déclinaison doit être SKI ou SPA.",
      );
    if (skiDayThree && activityProfile !== "ski")
      addError(
        errors,
        rowNumber,
        "Supp 3j ski",
        "Le troisième jour de ski nécessite la déclinaison SKI.",
      );
    if (!city)
      addError(
        errors,
        rowNumber,
        "Transport",
        "La ville ou Sans doit être indiquée.",
      );

    if (
      firstName &&
      lastName &&
      isValidEmail(email) &&
      gender &&
      role &&
      activityProfile &&
      city &&
      (!skiDayThree || activityProfile === "ski")
    ) {
      rows.push({
        row: rowNumber,
        firstName,
        lastName,
        email,
        gender,
        role,
        isVip: rawType === "Partner",
        activityProfile,
        skiDayThree,
        transportMode: city.toLowerCase() === "sans" ? "none" : "train",
        departureCity: city.toLowerCase() === "sans" ? null : city,
      });
    }
  }
  return complete(rows, errors, "La feuille ne contient aucune personne.");
}
