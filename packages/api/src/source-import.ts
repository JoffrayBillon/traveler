import ExcelJS from "exceljs";

export type ImportError = {
  row: number;
  field: string;
  message: string;
};

export type ValidatedRosterRow = {
  row: number;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: "M" | "F" | null;
  activityProfile: "ski" | "spa";
  amountPaidMinor: number | null;
  amountDueMinor: number | null;
  paymentStatus: "paid" | "partially_paid" | "unpaid" | null;
};

export type DetailedOrderRow = {
  row: number;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  gender: "M" | "F" | null;
  bookingStatus: "pending" | "validated";
  paymentStatus: "paid" | "partially_paid" | "unpaid" | null;
  activityProfile: "ski" | "spa";
  skiDayThree: boolean;
  transportMode: "train" | "none";
  departureCity: string | null;
};

export type StaffImportRow = {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  gender: "M" | "F";
  role: "companion" | "traveler";
  isVip: boolean;
  activityProfile: "ski" | "spa";
  skiDayThree: boolean;
  transportMode: "train" | "none";
  departureCity: string | null;
};

export type AgencyRoomingRow = {
  row: number;
  firstName: string;
  lastName: string;
  outboundSeat: string | null;
  returnSeat: string | null;
};

export type ParseResult<T> = { rows: T[]; errors: ImportError[] };

const maxRows = 500;

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
  const lineOptions = new Map<string, string[]>();
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
    const values = lineOptions.get(reference) ?? [];
    values.push(option);
    lineOptions.set(reference, values);
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
    const options = lineOptions.get(reference) ?? [];
    const activity = options.find(
      (option) => option.includes(" SKI") || option.includes(" SPA"),
    );
    const cityOption = options.find((option) =>
      ["PARIS", "NANTES", "BORDEAUX"].some((city) => option.endsWith(city)),
    );
    const skiDayThree = options.includes("FORFAIT SKI LUNDI");
    const activityProfile = activity?.includes("SPA")
      ? "spa"
      : activity?.includes("SKI")
        ? "ski"
        : null;
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
    if (
      options.filter(
        (option) => option.includes(" SKI") || option.includes(" SPA"),
      ).length !== 1
    )
      addError(
        errors,
        rowNumber,
        "Produit",
        "Une seule déclinaison SKI ou SPA est attendue par référence.",
      );
    if (skiDayThree && activityProfile !== "ski")
      addError(
        errors,
        rowNumber,
        "FORFAIT SKI LUNDI",
        "L’option du troisième jour nécessite la déclinaison SKI.",
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
      options.filter(
        (option) => option.includes(" SKI") || option.includes(" SPA"),
      ).length === 1
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
  for (const reference of lineOptions.keys()) {
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

export function normalizePersonName(firstName: string, lastName: string) {
  return `${normalizeName(lastName)}|${normalizeName(firstName)}`;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr");
}

function normalizeHeader(value: string) {
  return normalizeName(value.replace(/\n/g, " "));
}

function readHeaders(sheet: ExcelJS.Worksheet, required: string[]) {
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

function dataRows(
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

function isBoundedZip(data: ArrayBuffer) {
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

function cellReference(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (typeof value === "number")
    return Number.isInteger(value) ? String(value) : "";
  return cellText(cell).replace(/\s+/g, "");
}

function readMoney(cell: ExcelJS.Cell): number | null | false {
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

function normalizePaymentStatus(
  value: string,
): "paid" | "partially_paid" | "unpaid" | null {
  if (value === "Payée") return "paid";
  if (value === "Payée partiellement") return "partially_paid";
  if (value === "Non payée") return "unpaid";
  return null;
}

function derivePaymentStatus(
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function addError(
  errors: ImportError[],
  row: number,
  field: string,
  message: string,
) {
  errors.push({ row, field, message });
}

function failed<T = never>(message: string): ParseResult<T> {
  return { rows: [], errors: [{ row: 1, field: "Fichier", message }] };
}

function complete<T>(
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
