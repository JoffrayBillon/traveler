import {
  addError,
  cellReference,
  cellText,
  complete,
  dataRows,
  failed,
  isValidEmail,
  loadBoundedWorkbook,
  maxRows,
  normalizePaymentStatus,
  readHeaders,
} from "./shared";
import type { DetailedOrderRow, ImportError } from "./types";

export async function parseDetailedOrders(data: ArrayBuffer) {
  const workbook = await loadBoundedWorkbook(data);
  if (!workbook.ok) return workbook;
  const orderSheet = workbook.value.getWorksheet("Par commande");
  const lineSheet = workbook.value.getWorksheet("Par ligne de commande");
  if (!orderSheet || !lineSheet)
    return failed(
      "Les feuilles « Par commande » et « Par ligne de commande » sont obligatoires.",
    );
  const orderHeaders = readHeaders(orderSheet, [
    "Référence",
    "Nom",
    "Prénom",
    "Email",
    "Numéro de téléphone du bénéficiaire",
    "Statut de la commande",
    "Statut de la facture",
  ]);
  const lineHeaders = readHeaders(lineSheet, [
    "Référence",
    "Type",
    "Déclinaison / Option",
  ]);
  if (!orderHeaders.ok || !lineHeaders.ok) {
    return {
      rows: [] as DetailedOrderRow[],
      errors: [
        ...(!orderHeaders.ok ? orderHeaders.errors : []),
        ...(!lineHeaders.ok ? lineHeaders.errors : []),
      ],
    };
  }
  const genderColumn = orderHeaders.index.get("Matricule");
  const linesByReference = new Map<
    string,
    { products: string[]; options: string[] }
  >();
  const errors: ImportError[] = [];
  for (const rowNumber of dataRows(lineSheet, lineHeaders.index, [
    "Référence",
  ])) {
    const row = lineSheet.getRow(rowNumber);
    const reference = cellReference(
      row.getCell(lineHeaders.index.get("Référence") ?? 0),
    );
    const kind = cellText(row.getCell(lineHeaders.index.get("Type") ?? 0));
    const option = cellText(
      row.getCell(lineHeaders.index.get("Déclinaison / Option") ?? 0),
    ).toUpperCase();
    if (!reference) {
      addError(
        errors,
        rowNumber,
        "Référence",
        "La référence est obligatoire sur chaque ligne de produit ou d’option.",
      );
      continue;
    }
    if (kind !== "Produit" && kind !== "Option") {
      addError(
        errors,
        rowNumber,
        "Type",
        "Le type de ligne doit être Produit ou Option.",
      );
      continue;
    }
    if (!option) {
      addError(
        errors,
        rowNumber,
        "Déclinaison / Option",
        "La déclinaison ou l’option est obligatoire.",
      );
      continue;
    }
    const lines = linesByReference.get(reference) ?? {
      products: [],
      options: [],
    };
    if (kind === "Produit") lines.products.push(option);
    else lines.options.push(option);
    linesByReference.set(reference, lines);
  }

  const rows: DetailedOrderRow[] = [];
  const references = new Map<string, number>();
  for (const rowNumber of dataRows(orderSheet, orderHeaders.index, [
    "Référence",
    "Nom",
    "Prénom",
    "Email",
  ])) {
    const row = orderSheet.getRow(rowNumber);
    const reference = cellReference(
      row.getCell(orderHeaders.index.get("Référence") ?? 0),
    );
    const firstName = cellText(
      row.getCell(orderHeaders.index.get("Prénom") ?? 0),
    );
    const lastName = cellText(row.getCell(orderHeaders.index.get("Nom") ?? 0));
    const email = cellText(
      row.getCell(orderHeaders.index.get("Email") ?? 0),
    ).toLowerCase();
    const phone = cellText(
      row.getCell(
        orderHeaders.index.get("Numéro de téléphone du bénéficiaire") ?? 0,
      ),
    );
    const bookingStatusText = cellText(
      row.getCell(orderHeaders.index.get("Statut de la commande") ?? 0),
    );
    const invoiceStatusText = cellText(
      row.getCell(orderHeaders.index.get("Statut de la facture") ?? 0),
    );
    const { products, options } = linesByReference.get(reference) ?? {
      products: [],
      options: [],
    };
    const activity = products[0]?.match(/(?:^|\s)(SKI|SPA)$/)?.[1];
    const cityOption = options.find((option) =>
      ["PARIS", "NANTES", "BORDEAUX"].some((city) => option.endsWith(city)),
    );
    const skiDayThree = options.includes("FORFAIT SKI LUNDI");
    const activityProfile =
      activity === "SPA" ? "spa" : activity === "SKI" ? "ski" : null;
    const bookingStatus =
      bookingStatusText === "Validée"
        ? "validated"
        : bookingStatusText === "En attente de validation"
          ? "pending"
          : null;
    const paymentStatus = normalizePaymentStatus(invoiceStatusText);
    const genderValue = genderColumn
      ? cellText(row.getCell(genderColumn)).toUpperCase()
      : "";
    const gender =
      genderValue === "H" || genderValue === "M"
        ? "M"
        : genderValue === "F"
          ? "F"
          : null;

    if (!reference)
      addError(errors, rowNumber, "Référence", "La référence est obligatoire.");
    if (reference && references.has(reference))
      addError(
        errors,
        rowNumber,
        "Référence",
        `Référence en double ligne ${references.get(reference)}.`,
      );
    else if (reference) references.set(reference, rowNumber);
    if (!firstName)
      addError(errors, rowNumber, "Prénom", "Le prénom est obligatoire.");
    if (!lastName)
      addError(errors, rowNumber, "Nom", "Le nom est obligatoire.");
    if (!isValidEmail(email))
      addError(errors, rowNumber, "Email", "L’adresse e-mail est invalide.");
    if (!bookingStatus)
      addError(
        errors,
        rowNumber,
        "Statut de la commande",
        "Statut de commande inconnu.",
      );
    if (invoiceStatusText && !paymentStatus)
      addError(
        errors,
        rowNumber,
        "Statut de la facture",
        "Statut de facture inconnu.",
      );
    if (!activityProfile)
      addError(
        errors,
        rowNumber,
        "Produit",
        "Déclinaison SKI ou SPA introuvable pour cette référence.",
      );
    if (products.length > 1)
      addError(
        errors,
        rowNumber,
        "Produit",
        "Une seule déclinaison SKI ou SPA est attendue par référence.",
      );
    if (
      options.filter((option) =>
        ["PARIS", "NANTES", "BORDEAUX"].some((city) => option.endsWith(city)),
      ).length > 1
    )
      addError(
        errors,
        rowNumber,
        "Transport",
        "Une seule ville de départ est autorisée par référence.",
      );

    if (
      reference &&
      firstName &&
      lastName &&
      isValidEmail(email) &&
      bookingStatus &&
      activityProfile &&
      products.length === 1
    ) {
      rows.push({
        row: rowNumber,
        reference,
        firstName,
        lastName,
        email,
        phone: phone || null,
        gender,
        bookingStatus,
        paymentStatus,
        activityProfile,
        skiDayThree,
        transportMode: cityOption ? "train" : "none",
        departureCity: cityOption?.split(" ").at(-1) ?? null,
      });
    }
  }
  for (const reference of linesByReference.keys()) {
    if (!references.has(reference))
      addError(
        errors,
        1,
        "Référence",
        "Une référence de ligne produit n’existe pas dans la feuille de commandes.",
      );
  }
  if (rows.length > maxRows)
    addError(
      errors,
      1,
      "Fichier",
      `Le fichier dépasse la limite de ${maxRows} commandes.`,
    );
  return complete(rows, errors, "La feuille ne contient aucune commande.");
}
