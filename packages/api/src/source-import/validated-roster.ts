import {
  addError,
  cellReference,
  cellText,
  complete,
  dataRows,
  derivePaymentStatus,
  failed,
  isValidEmail,
  loadBoundedWorkbook,
  maxRows,
  readHeaders,
  readMoney,
} from "./shared";
import type { ImportError, ValidatedRosterRow } from "./types";

export async function parseValidatedRoster(data: ArrayBuffer) {
  const workbook = await loadBoundedWorkbook(data);
  if (!workbook.ok) return workbook;
  const sheet = workbook.value.worksheets[0];
  if (!sheet) return failed("Le classeur ne contient aucune feuille.");
  const headers = readHeaders(sheet, [
    "Nom",
    "Prénom",
    "Email",
    "Référence",
    "Référence produit",
    "Statut de la commande",
    "Montant déjà réglé",
    "Restant dû sur la commande",
  ]);
  if (!headers.ok)
    return { rows: [] as ValidatedRosterRow[], errors: headers.errors };
  const genderColumn = headers.index.get("Matricule");
  const errors: ImportError[] = [];
  const rows: ValidatedRosterRow[] = [];
  const references = new Map<string, number>();

  for (const rowNumber of dataRows(sheet, headers.index, [
    "Référence",
    "Nom",
    "Prénom",
    "Email",
  ])) {
    const row = sheet.getRow(rowNumber);
    const reference = cellReference(
      row.getCell(headers.index.get("Référence") ?? 0),
    );
    const firstName = cellText(row.getCell(headers.index.get("Prénom") ?? 0));
    const lastName = cellText(row.getCell(headers.index.get("Nom") ?? 0));
    const email = cellText(
      row.getCell(headers.index.get("Email") ?? 0),
    ).toLowerCase();
    const product = cellText(
      row.getCell(headers.index.get("Référence produit") ?? 0),
    ).toUpperCase();
    const orderStatus = cellText(
      row.getCell(headers.index.get("Statut de la commande") ?? 0),
    );
    const genderValue = genderColumn
      ? cellText(row.getCell(genderColumn)).toUpperCase()
      : "";
    const gender =
      genderValue === "H" || genderValue === "M"
        ? "M"
        : genderValue === "F"
          ? "F"
          : null;
    const activityProfile = product.includes("SPA")
      ? "spa"
      : product.includes("SKI")
        ? "ski"
        : null;

    if (!reference)
      addError(errors, rowNumber, "Référence", "La référence est obligatoire.");
    if (reference && references.has(reference)) {
      addError(
        errors,
        rowNumber,
        "Référence",
        `Référence déjà utilisée ligne ${references.get(reference)}.`,
      );
    } else if (reference) {
      references.set(reference, rowNumber);
    }
    if (!firstName)
      addError(errors, rowNumber, "Prénom", "Le prénom est obligatoire.");
    if (!lastName)
      addError(errors, rowNumber, "Nom", "Le nom est obligatoire.");
    if (!isValidEmail(email))
      addError(errors, rowNumber, "Email", "L’adresse e-mail est invalide.");
    if (orderStatus !== "Validée")
      addError(
        errors,
        rowNumber,
        "Statut de la commande",
        "La liste validée ne doit contenir que des commandes validées.",
      );
    if (!activityProfile)
      addError(
        errors,
        rowNumber,
        "Référence produit",
        "La déclinaison doit contenir SKI ou SPA.",
      );
    const amountPaidMinor = readMoney(
      row.getCell(headers.index.get("Montant déjà réglé") ?? 0),
    );
    const amountDueMinor = readMoney(
      row.getCell(headers.index.get("Restant dû sur la commande") ?? 0),
    );
    const paymentStatus = derivePaymentStatus(
      amountPaidMinor === false ? null : amountPaidMinor,
      amountDueMinor === false ? null : amountDueMinor,
    );
    if (amountPaidMinor === false)
      addError(errors, rowNumber, "Montant déjà réglé", "Montant invalide.");
    if (amountDueMinor === false)
      addError(
        errors,
        rowNumber,
        "Restant dû sur la commande",
        "Montant invalide.",
      );
    if (
      reference &&
      firstName &&
      lastName &&
      isValidEmail(email) &&
      activityProfile &&
      orderStatus === "Validée" &&
      amountPaidMinor !== false &&
      amountDueMinor !== false
    ) {
      rows.push({
        row: rowNumber,
        reference,
        firstName,
        lastName,
        email,
        gender,
        activityProfile,
        amountPaidMinor,
        amountDueMinor,
        paymentStatus,
      });
    }
    if (rows.length > maxRows) {
      addError(
        errors,
        rowNumber,
        "Fichier",
        `Le fichier dépasse la limite de ${maxRows} lignes.`,
      );
      break;
    }
  }

  return complete(rows, errors, "La feuille ne contient aucune inscription.");
}
