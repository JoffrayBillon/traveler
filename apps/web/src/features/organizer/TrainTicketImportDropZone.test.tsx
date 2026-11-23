import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@traveler/i18n";
import { expect, it, vi } from "vitest";
import { TrainTicketImportDropZone } from "./TrainTicketImportDropZone";

it("queues several PDFs and excludes non-PDF files", async () => {
  const user = userEvent.setup({ applyAccept: false });
  const onFilesChange = vi.fn();
  const { container } = render(
    <TrainTicketImportDropZone
      files={[]}
      fileStatuses={{}}
      onFilesChange={onFilesChange}
    />,
  );
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Missing PDF picker");

  await user.upload(input, [
    new File(["synthetic one"], "outbound.pdf", { type: "application/pdf" }),
    new File(["synthetic two"], "return.pdf", { type: "application/pdf" }),
    new File(["not a ticket"], "notes.txt", { type: "text/plain" }),
  ]);

  await waitFor(() => expect(onFilesChange).toHaveBeenCalled());
  expect(onFilesChange).toHaveBeenLastCalledWith([
    expect.objectContaining({ name: "outbound.pdf" }),
    expect.objectContaining({ name: "return.pdf" }),
  ]);
  expect(screen.getByRole("alert")).toHaveTextContent("Seuls les fichiers PDF");
});
