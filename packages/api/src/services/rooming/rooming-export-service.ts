import ExcelJS from "exceljs";
import type { AppDatabase } from "../../auth";
import { getRoomingExportData } from "../../datamodel/rooming.repository";

export async function exportRoomingWorkbook(
  database: AppDatabase,
  tripId: string,
) {
  const { rooms, occupants } = await getRoomingExportData(database, tripId);
  const occupantsByRoom = new Map<string, (typeof occupants)[number][]>();
  for (const occupant of occupants) {
    const roomOccupants = occupantsByRoom.get(occupant.roomId) ?? [];
    roomOccupants.push(occupant);
    occupantsByRoom.set(occupant.roomId, roomOccupants);
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rooming");
  sheet.addRow([
    "Chambre",
    "Capacité",
    "Statut",
    "Nom",
    "Prénom",
    "Genre",
    "E-mail",
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const room of rooms) {
    const people = occupantsByRoom.get(room.id) ?? [];
    const status =
      room.genderPolicy === "mixed"
        ? "Mixte validée"
        : room.genderPolicy === "unset"
          ? "À définir"
          : "Non-mixte";
    if (people.length === 0) {
      sheet.addRow([room.name, room.capacity, status, "", "", "", ""]);
    } else {
      people.forEach((person, index) => {
        sheet.addRow([
          index === 0 ? room.name : "",
          index === 0 ? room.capacity : "",
          index === 0 ? status : "",
          person.lastName,
          person.firstName,
          person.gender ?? "",
          person.email,
        ]);
      });
    }
  }
  sheet.columns = [
    { width: 24 },
    { width: 12 },
    { width: 18 },
    { width: 24 },
    { width: 24 },
    { width: 12 },
    { width: 38 },
  ];
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
