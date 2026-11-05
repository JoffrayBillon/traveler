import ExcelJS from "exceljs";
import { expect, it } from "vitest";
import { parseDetailedOrders } from "./detailed-orders";

async function parseOrder(lines: string[][]) {
  const workbook = new ExcelJS.Workbook();
  const orders = workbook.addWorksheet("Par commande");
  orders.addRow([
    "Référence",
    "Nom",
    "Prénom",
    "Email",
    "Numéro de téléphone du bénéficiaire",
    "Statut de la commande",
    "Statut de la facture",
  ]);
  orders.addRow([
    "123",
    "Example",
    "Alex",
    "alex@example.com",
    "",
    "Validée",
    "Payée",
  ]);
  const items = workbook.addWorksheet("Par ligne de commande");
  items.addRow(["Référence", "Type", "Déclinaison / Option"]);
  for (const line of lines) items.addRow(["123", ...line]);
  return parseDetailedOrders(
    new Uint8Array(await workbook.xlsx.writeBuffer()).buffer,
  );
}

it("uses the product for the formula and keeps independent transport and Monday options", async () => {
  const parsed = await parseOrder([
    ["Option", "WE Ski 2027 PARIS"],
    ["Produit", "WE Ski 2027 SPA"],
    ["Option", "FORFAIT SKI LUNDI"],
  ]);
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0]).toMatchObject({
    activityProfile: "spa",
    skiDayThree: true,
    transportMode: "train",
    departureCity: "PARIS",
  });
});

it("rejects two base products for one reference", async () => {
  const parsed = await parseOrder([
    ["Produit", "WE Ski 2027 SKI"],
    ["Produit", "WE Ski 2027 SPA"],
  ]);
  expect(parsed.rows).toEqual([]);
  expect(parsed.errors).toEqual([
    expect.objectContaining({ row: 2, field: "Produit" }),
  ]);
});
