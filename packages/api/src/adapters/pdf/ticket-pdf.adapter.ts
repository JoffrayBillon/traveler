import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { PDFPage } from "pdf-lib";

const MAX_TICKET_PDF_BYTES = 4 * 1024 * 1024;
const MAX_TICKET_PDF_PAGES = 200;

export type PdfTextBlock = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfPage = {
  pageNumber: number;
  width: number;
  height: number;
  textBlocks: PdfTextBlock[];
  hasVisibleContent: boolean;
};

function validatePdfBytes(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0)
    throw new Error("The PDF is empty or invalid.");
  if (bytes.byteLength > MAX_TICKET_PDF_BYTES)
    throw new Error("The PDF exceeds the 4 MiB processing limit.");
}

function assertPdfHeader(bytes: Uint8Array) {
  const headerWindow = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (!headerWindow.includes("%PDF-"))
    throw new Error("The uploaded file is not a PDF.");
}

export async function readTicketPdf(bytes: Uint8Array): Promise<PdfPage[]> {
  validatePdfBytes(bytes);
  assertPdfHeader(bytes);

  // Keep the copy implementation able to reopen every source accepted by analysis.
  const { PDFDocument } = await import("pdf-lib");
  const validatedDocument = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    updateMetadata: false,
    throwOnInvalidObject: true,
  });
  if (
    validatedDocument.getPageCount() < 1 ||
    validatedDocument.getPageCount() > MAX_TICKET_PDF_PAGES
  )
    throw new Error("The PDF must contain between 1 and 200 pages.");

  // Keep the large PDF.js parser out of normal API cold starts that do not inspect tickets.
  const { getDocument, GlobalWorkerOptions, OPS } = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );
  // Resolve the fake worker explicitly so the serverless bundle traces it.
  const worker = createRequire(import.meta.url).resolve(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href;
  const loadingTask = getDocument({
    data: Uint8Array.from(bytes),
    useSystemFonts: true,
    useWorkerFetch: false,
    verbosity: 0,
  });

  try {
    const document = await loadingTask.promise;
    if (document.numPages !== validatedDocument.getPageCount())
      throw new Error("The PDF must contain between 1 and 200 pages.");

    const pages: PdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const textBlocks: PdfTextBlock[] = [];

      for (const item of content.items) {
        if (!("str" in item)) continue;
        const [x, y] = viewport.convertToViewportPoint(
          item.transform[4],
          item.transform[5],
        );
        const height =
          Math.abs(item.height) ||
          Math.hypot(item.transform[2], item.transform[3]);
        textBlocks.push({
          text: item.str,
          x,
          y: Math.max(0, y - height),
          width: Math.abs(item.width),
          height,
        });
      }

      const hasText = textBlocks.some(({ text }) => text.trim().length > 0);
      const operatorList = hasText ? null : await page.getOperatorList();
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        textBlocks,
        hasVisibleContent:
          hasText ||
          operatorList?.fnArray.some((operator) =>
            isVisibleOperator(operator, OPS),
          ) === true,
      });
      page.cleanup();
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

function isVisibleOperator(
  operator: number,
  ops: typeof import("pdfjs-dist/legacy/build/pdf.mjs").OPS,
) {
  // PDF.js OPS includes path painting, text, image and shading operations here.
  // Graphics-state changes and clipping alone do not make a page visibly non-empty.
  return [
    ops.stroke,
    ops.closeStroke,
    ops.fill,
    ops.eoFill,
    ops.fillStroke,
    ops.closeFillStroke,
    ops.closeEOFillStroke,
    ops.paintFormXObjectBegin,
    ops.shadingFill,
    ops.showText,
    ops.showSpacedText,
    ops.nextLineShowText,
    ops.nextLineSetSpacingShowText,
    ops.paintImageXObject,
    ops.paintInlineImageXObject,
    ops.paintImageMaskXObject,
    ops.paintImageXObjectRepeat,
    ops.paintImageMaskXObjectRepeat,
    ops.paintSolidColorImageMask,
  ].includes(operator);
}

export async function extractTicketPages(
  bytes: Uint8Array,
  pageNumbers: readonly number[],
): Promise<Uint8Array> {
  validatePdfBytes(bytes);
  assertPdfHeader(bytes);
  if (pageNumbers.length === 0 || pageNumbers.length > MAX_TICKET_PDF_PAGES)
    throw new Error("Select between 1 and 200 PDF pages.");

  const distinctPageNumbers = [...new Set(pageNumbers)];
  if (distinctPageNumbers.length !== pageNumbers.length)
    throw new Error("A PDF page can only be selected once.");
  if (
    distinctPageNumbers.some(
      (pageNumber) =>
        !Number.isInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > MAX_TICKET_PDF_PAGES,
    )
  )
    throw new Error("PDF page numbers must be between 1 and 200.");

  const { PDFDocument, PDFName } = await import("pdf-lib");
  const source = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    updateMetadata: false,
    throwOnInvalidObject: true,
  });
  if (source.getPageCount() > MAX_TICKET_PDF_PAGES)
    throw new Error("The PDF must contain no more than 200 pages.");
  if (
    distinctPageNumbers.some((pageNumber) => pageNumber > source.getPageCount())
  )
    throw new Error("A selected page does not exist in the PDF.");

  // Remove cross-page links and actions from every source page before copying.
  // Otherwise pdf-lib may recursively copy a linked, unselected page as well.
  for (const page of source.getPages())
    stripInteractivePageData(page, (key) => PDFName.of(key));

  const result = await PDFDocument.create();
  const pages = await result.copyPages(
    source,
    distinctPageNumbers.map((pageNumber) => pageNumber - 1),
  );
  for (const page of pages) {
    result.addPage(page);
  }

  // A fresh catalog excludes source attachments, forms, document actions, JavaScript
  // name trees, and metadata. Remove active page-level entries after copying each page.
  return result.save({ useObjectStreams: true, addDefaultPage: false });
}

function stripInteractivePageData(
  page: PDFPage,
  name: (key: string) => ReturnType<typeof import("pdf-lib").PDFName.of>,
) {
  page.node.delete(name("Annots"));
  page.node.delete(name("AA"));
  page.node.delete(name("OpenAction"));
  page.node.delete(name("JavaScript"));
  page.node.delete(name("AF"));
  page.node.delete(name("EmbeddedFiles"));
  page.node.delete(name("B"));
  page.node.delete(name("Metadata"));
  page.node.delete(name("PieceInfo"));
  page.node.delete(name("StructParents"));
  page.node.delete(name("StructParent"));
  page.node.delete(name("Dur"));
  page.node.delete(name("Trans"));
  page.node.delete(name("PresSteps"));
}
