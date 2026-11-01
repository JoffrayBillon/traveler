import type { TFunction } from "i18next";
import { getTranslationKeyForFrenchSourceText } from "../../i18n/resources";

export function importSummaryLabel(key: string, t: TFunction) {
  const labels: Record<string, string> = {
    added: "toAdd",
    updated: "toUpdate",
    unchanged: "unchangedItems",
    removed: "missingFromTheNewSnapshot",
    missingDetail: "withoutDetailedInformation",
    orders: "orders",
    rows: "people",
    matched: "exactMatches",
    unmatched: "namesNotFound",
    ambiguous: "ambiguousNames",
    outboundPlacements: "outboundPlacements",
    returnPlacements: "returnPlacements",
  };
  return t(labels[key] ?? key);
}

export function importChangeLabel(action: string, t: TFunction) {
  const labels: Record<string, string> = {
    added: "toAdd2",
    updated: "toUpdate2",
    unchanged: "unchangedItems",
    removed: "toCancel",
    enriched: "existingDetails",
    new_detail: "newDetails",
  };
  return t(labels[action] ?? action);
}

function translateSourceText(value: string, t: TFunction) {
  const key = getTranslationKeyForFrenchSourceText(value);
  return key ? t(key) : value;
}

export function formatImportError(
  error: { row: number; field: string; message: string },
  t: TFunction,
) {
  const message = error.message;
  const duplicateReference =
    /^Référence (déjà utilisée|en double) ligne (\d+)\.$/.exec(message);
  const duplicateEmail = /^Adresse déjà utilisée ligne (\d+)\.$/.exec(message);
  const duplicatePerson = /^Personne en double \(ligne (\d+)\)\.$/.exec(
    message,
  );
  const rowLimit =
    /^Le fichier dépasse la limite de (\d+) (commandes|voyageurs|lignes)\.$/.exec(
      message,
    );
  const missingColumns = /^Colonne\(s\) absente\(s\) : (.+)\.$/.exec(message);
  const missingColumn = /^Colonne obligatoire absente : (.+)\.$/.exec(message);
  let localizedMessage = message;
  if (duplicateReference?.[2]) {
    localizedMessage = t(
      duplicateReference[1] === "en double"
        ? "duplicateReferenceOnRowRow"
        : "referenceAlreadyUsedOnRowRow",
      { row: duplicateReference[2] },
    );
  } else if (duplicateEmail?.[1]) {
    localizedMessage = t("addressAlreadyUsedOnRowRow", {
      row: duplicateEmail[1],
    });
  } else if (duplicatePerson?.[1]) {
    localizedMessage = t("duplicatePersonRowRow", { row: duplicatePerson[1] });
  } else if (rowLimit?.[1] && rowLimit[2]) {
    const limitKinds: Record<string, string> = {
      commandes: "orders",
      voyageurs: "travelers",
      lignes: "rows",
    };
    localizedMessage = t("theFileExceedsTheLimitOfCountKind", {
      count: rowLimit[1],
      kind: t(limitKinds[rowLimit[2]] ?? "rows"),
    });
  } else if (missingColumns?.[1]) {
    localizedMessage = t("missingColumnSColumns", {
      columns: missingColumns[1]
        .split(",")
        .map((column) => translateSourceText(column, t))
        .join(","),
    });
  } else if (missingColumn?.[1]) {
    localizedMessage = t("requiredColumnMissingColumn", {
      column: translateSourceText(missingColumn[1], t),
    });
  } else {
    localizedMessage = translateSourceText(message, t);
  }
  return t("rowRowFieldMessage", {
    row: error.row,
    field: translateSourceText(error.field, t),
    message: localizedMessage,
  });
}
