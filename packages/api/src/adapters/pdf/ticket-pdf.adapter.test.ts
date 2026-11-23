import { PDFDocument, PDFName, rgb } from "pdf-lib";
import { expect, it } from "vitest";
import { extractTicketPages, readTicketPdf } from "./ticket-pdf.adapter";

async function createPdf() {
  const document = await PDFDocument.create();
  const first = document.addPage([400, 500]);
  first.drawText("TGV INOUI GROUPE E-BILLET 123456789");
  first.drawRectangle({
    x: 20,
    y: 20,
    width: 30,
    height: 30,
    color: rgb(0, 0, 0),
  });
  document.addPage([400, 500]);
  const image = await document.embedPng(
    Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lM8AAAAASUVORK5CYII=",
        "base64",
      ),
    ),
  );
  document
    .addPage([400, 500])
    .drawImage(image, { x: 20, y: 20, width: 10, height: 10 });
  return { document, first };
}

it("reads positioned text and distinguishes a visible page from a blank page", async () => {
  const { document } = await createPdf();
  const pages = await readTicketPdf(await document.save());

  expect(pages).toHaveLength(3);
  expect(pages[0]?.textBlocks.map(({ text }) => text).join(" ")).toContain(
    "INOUI",
  );
  expect(pages[0]?.hasVisibleContent).toBe(true);
  expect(pages[1]?.textBlocks).toHaveLength(0);
  expect(pages[1]?.hasVisibleContent).toBe(false);
  expect(pages[2]?.textBlocks).toHaveLength(0);
  expect(pages[2]?.hasVisibleContent).toBe(true);
});

it("copies only requested 1-based pages and removes page annotations", async () => {
  const { document, first } = await createPdf();
  first.node.set(PDFName.of("Annots"), document.context.obj([]));
  first.node.set(
    PDFName.of("AA"),
    document.context.obj({ O: { S: "JavaScript" } }),
  );
  const output = await extractTicketPages(await document.save(), [3, 1]);
  const extracted = await PDFDocument.load(output);

  expect(extracted.getPageCount()).toBe(2);
  const annotations = extracted.getPage(1).node.get(PDFName.of("Annots"));
  const pageActions = extracted.getPage(1).node.get(PDFName.of("AA"));
  expect(annotations).toBeUndefined();
  expect(pageActions).toBeUndefined();
  const pages = await readTicketPdf(output);
  expect(pages[1]?.textBlocks.map(({ text }) => text).join(" ")).toContain(
    "INOUI",
  );
});

it("does not copy an unselected page linked by a source annotation", async () => {
  const document = await PDFDocument.create();
  const selected = document.addPage([400, 500]);
  selected.drawText("VISIBLE TICKET");
  const privatePage = document.addPage([400, 500]);
  privatePage.drawText("PRIVATE PAGE MARKER");
  const link = document.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [0, 0, 100, 100],
    Dest: [privatePage.ref, PDFName.of("Fit")],
  });
  selected.node.set(PDFName.of("Annots"), document.context.obj([link]));

  const output = await extractTicketPages(await document.save(), [1]);
  const extracted = await PDFDocument.load(output);
  const pages = await readTicketPdf(output);

  expect(extracted.getPageCount()).toBe(1);
  expect(pages[0]?.textBlocks.map(({ text }) => text).join(" ")).toContain(
    "VISIBLE TICKET",
  );
  expect(pages[0]?.textBlocks.map(({ text }) => text).join(" ")).not.toContain(
    "PRIVATE PAGE MARKER",
  );
});

it("preserves visible image artwork when extracting a page", async () => {
  const { document } = await createPdf();
  const output = await extractTicketPages(await document.save(), [3]);
  const [page] = await readTicketPdf(output);
  expect(page?.hasVisibleContent).toBe(true);
  expect(page?.textBlocks).toHaveLength(0);
});

it("rejects invalid, duplicate, and out-of-range page selections", async () => {
  const { document } = await createPdf();
  const bytes = await document.save();
  await expect(extractTicketPages(bytes, [])).rejects.toThrow("Select between");
  await expect(extractTicketPages(bytes, [1, 1])).rejects.toThrow(
    "only be selected once",
  );
  await expect(extractTicketPages(bytes, [4])).rejects.toThrow(
    "does not exist",
  );
  await expect(
    extractTicketPages(new Uint8Array([1, 2, 3]), [1]),
  ).rejects.toThrow("not a PDF");
});

it("ignores blank pages in a document without dropping page numbering", async () => {
  const { document } = await createPdf();
  const pages = await readTicketPdf(await document.save());
  expect(pages.map(({ pageNumber }) => pageNumber)).toEqual([1, 2, 3]);
});
