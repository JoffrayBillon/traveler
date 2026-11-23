import { extractTicketPages } from "../../adapters/pdf/ticket-pdf.adapter";

export const maxTrainTicketPdfBytes = 4 * 1024 * 1024;

export async function readTrainTicketPages(
  stream: ReadableStream<Uint8Array>,
  pageNumbers: readonly number[],
) {
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  if (bytes.length > maxTrainTicketPdfBytes)
    throw new Error("Oversized ticket source.");
  const pages = await extractTicketPages(bytes, pageNumbers);
  if (!pages.length || pages.length > maxTrainTicketPdfBytes) {
    throw new Error("Invalid ticket PDF output size.");
  }
  return new Uint8Array(pages);
}
