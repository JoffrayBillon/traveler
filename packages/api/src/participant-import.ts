import ExcelJS from "exceljs";

export const participantImportHeaders = [
  "Nom",
  "Prenom",
  "Email",
  "Genre",
  "ProfilActivite",
  "OptionSkiJ3",
  "TypeTransport",
  "VilleDepart",
  "Aller_Ref",
  "Aller_HeureRDV",
  "Aller_HeureDepart",
  "Aller_Siege",
  "Retour_Ref",
  "Retour_HeureRDV",
  "Retour_HeureDepart",
  "Retour_Siege",
  "ChambreInitiale",
] as const;

export type ImportedParticipant = {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  gender: "M" | "F";
  activityProfile: "ski" | "spa";
  skiDayThree: boolean;
  transportMode: "train" | "flight" | "none";
  departureCity: string | null;
  outboundReference: string | null;
  outboundMeetingTime: string | null;
  outboundDepartureTime: string | null;
  outboundSeat: string | null;
  returnReference: string | null;
  returnMeetingTime: string | null;
  returnDepartureTime: string | null;
  returnSeat: string | null;
  initialRoomName: string | null;
};

export type ParticipantImportError = {
  row: number;
  field: string;
  message: string;
};

export async function parseParticipantWorkbook(data: ArrayBuffer) {
  if (!isBoundedZip(data)) {
    return {
      participants: [] as ImportedParticipant[],
      errors: [
        {
          row: 1,
          field: "fichier",
          message:
            "Le classeur Excel est invalide ou dépasse la taille décompressée autorisée.",
        },
      ],
    };
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    return {
      participants: [] as ImportedParticipant[],
      errors: [
        {
          row: 1,
          field: "fichier",
          message: "Le fichier Excel est illisible.",
        },
      ],
    };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      participants: [] as ImportedParticipant[],
      errors: [
        {
          row: 1,
          field: "fichier",
          message: "Le classeur ne contient aucune feuille.",
        },
      ],
    };
  }
  const headerCells = sheet.getRow(1).values as unknown[];
  const headerIndex = new Map<string, number>();
  for (let column = 1; column < headerCells.length; column += 1) {
    const header = String(headerCells[column] ?? "").trim();
    if (header) headerIndex.set(header, column);
  }
  const errors: ParticipantImportError[] = [];
  const missingHeaders = participantImportHeaders.filter(
    (header) => !headerIndex.has(header),
  );
  for (const header of missingHeaders) {
    errors.push({
      row: 1,
      field: header,
      message: `Colonne obligatoire absente : ${header}.`,
    });
  }
  for (const header of headerIndex.keys()) {
    if (
      headerCells.filter((value) => String(value ?? "").trim() === header)
        .length > 1
    ) {
      errors.push({
        row: 1,
        field: header,
        message: `Colonne en double : ${header}.`,
      });
    }
  }
  if (errors.length)
    return { participants: [] as ImportedParticipant[], errors };

  const participantRows: number[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 2) return;
    if (
      participantImportHeaders.some((header) =>
        cellText(row.getCell(headerIndex.get(header) ?? 0)),
      )
    ) {
      participantRows.push(rowNumber);
    }
  });
  if (participantRows.length === 0) {
    return {
      participants: [] as ImportedParticipant[],
      errors: [
        {
          row: 1,
          field: "fichier",
          message: "La feuille ne contient aucune ligne participant.",
        },
      ],
    };
  }
  if (participantRows.length > 500) {
    return {
      participants: [] as ImportedParticipant[],
      errors: [
        {
          row: participantRows[500] ?? 1,
          field: "fichier",
          message: "Le fichier dépasse la limite de 500 participants.",
        },
      ],
    };
  }

  const participants: ImportedParticipant[] = [];
  const emailRows = new Map<string, number>();
  for (const rowNumber of participantRows) {
    const row = sheet.getRow(rowNumber);
    const value = (header: (typeof participantImportHeaders)[number]) =>
      cellText(row.getCell(headerIndex.get(header) ?? 0));
    if (participantImportHeaders.every((header) => !value(header))) continue;

    const participant = {
      row: rowNumber,
      firstName: value("Prenom"),
      lastName: value("Nom"),
      email: value("Email").toLowerCase(),
      gender: value("Genre").toUpperCase() as "M" | "F",
      activityProfile: normalizeActivity(value("ProfilActivite")),
      skiDayThree: normalizeBoolean(value("OptionSkiJ3")),
      transportMode: value("TypeTransport").toLowerCase() as
        | "train"
        | "flight"
        | "none",
      departureCity: nullable(value("VilleDepart")),
      outboundReference: nullable(value("Aller_Ref")),
      outboundMeetingTime: normalizeTime(value("Aller_HeureRDV")),
      outboundDepartureTime: normalizeTime(value("Aller_HeureDepart")),
      outboundSeat: nullable(value("Aller_Siege")),
      returnReference: nullable(value("Retour_Ref")),
      returnMeetingTime: normalizeTime(value("Retour_HeureRDV")),
      returnDepartureTime: normalizeTime(value("Retour_HeureDepart")),
      returnSeat: nullable(value("Retour_Siege")),
      initialRoomName: nullable(value("ChambreInitiale")),
    };

    const rowErrorStart = errors.length;
    if (!participant.firstName)
      addError(errors, rowNumber, "Prenom", "Le prénom est obligatoire.");
    if (!participant.lastName)
      addError(errors, rowNumber, "Nom", "Le nom est obligatoire.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participant.email))
      addError(errors, rowNumber, "Email", "L’adresse e-mail est invalide.");
    if (participant.email && emailRows.has(participant.email)) {
      addError(
        errors,
        rowNumber,
        "Email",
        `Adresse en double sur la ligne ${emailRows.get(participant.email)}.`,
      );
    } else if (participant.email) {
      emailRows.set(participant.email, rowNumber);
    }
    if (participant.gender !== "M" && participant.gender !== "F")
      addError(errors, rowNumber, "Genre", "Le genre doit être M ou F.");
    if (
      participant.activityProfile !== "ski" &&
      participant.activityProfile !== "spa"
    )
      addError(
        errors,
        rowNumber,
        "ProfilActivite",
        "Le profil doit être skier ou spa.",
      );
    if (participant.skiDayThree === null)
      addError(
        errors,
        rowNumber,
        "OptionSkiJ3",
        "La valeur doit être Oui ou Non.",
      );
    if (participant.skiDayThree && participant.activityProfile === "spa")
      addError(
        errors,
        rowNumber,
        "OptionSkiJ3",
        "Le ski J3 nécessite le profil skier.",
      );
    if (!["train", "flight", "none"].includes(participant.transportMode))
      addError(
        errors,
        rowNumber,
        "TypeTransport",
        "Le transport doit être train, flight ou none.",
      );
    for (const [field, time] of [
      ["Aller_HeureRDV", participant.outboundMeetingTime],
      ["Aller_HeureDepart", participant.outboundDepartureTime],
      ["Retour_HeureRDV", participant.returnMeetingTime],
      ["Retour_HeureDepart", participant.returnDepartureTime],
    ] as const) {
      if (time === false)
        addError(
          errors,
          rowNumber,
          field,
          "L’heure doit être au format HH:mm.",
        );
    }
    if (
      participant.transportMode === "none" &&
      [
        participant.departureCity,
        participant.outboundReference,
        participant.outboundMeetingTime,
        participant.outboundDepartureTime,
        participant.outboundSeat,
        participant.returnReference,
        participant.returnMeetingTime,
        participant.returnDepartureTime,
        participant.returnSeat,
      ].some(Boolean)
    ) {
      addError(
        errors,
        rowNumber,
        "TypeTransport",
        "Les champs de trajet doivent rester vides sans transport réservé.",
      );
    }
    if (errors.length === rowErrorStart) {
      participants.push(participant as ImportedParticipant);
    }
  }
  if (participants.length === 0 && errors.length === 0) {
    addError(errors, 2, "fichier", "Aucun participant à importer.");
  }
  return errors.length
    ? { participants: [] as ImportedParticipant[], errors }
    : { participants, errors };
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
  ) {
    return false;
  }
  let offset = directoryOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > bytes.byteLength ||
      bytes.getUint32(offset, true) !== 0x02014b50
    ) {
      return false;
    }
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

function cellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "object" && value !== null && "richText" in value) {
    return value.richText
      .map((part) => part.text)
      .join("")
      .trim();
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return String(value.result ?? "").trim();
  }
  return String(cell.text ?? "").trim();
}

function normalizeActivity(value: string): "ski" | "spa" | "invalid" {
  const normalized = value.toLowerCase();
  if (normalized === "ski" || normalized === "skier") return "ski";
  if (normalized === "spa") return "spa";
  return "invalid";
}

function normalizeBoolean(value: string): boolean | null {
  const normalized = value.toLowerCase();
  if (["oui", "true", "1"].includes(normalized)) return true;
  if (["non", "false", "0"].includes(normalized)) return false;
  return null;
}

function normalizeTime(value: string): string | null | false {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, "");
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return false;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function nullable(value: string) {
  return value.trim() || null;
}

function addError(
  errors: ParticipantImportError[],
  row: number,
  field: string,
  message: string,
) {
  errors.push({ row, field, message });
}
