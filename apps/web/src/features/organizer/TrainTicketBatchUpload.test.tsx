import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@traveler/i18n";
import { afterEach, expect, it, vi } from "vitest";
import { TrainTicketBatchUpload } from "./TrainTicketBatchUpload";

afterEach(() => vi.unstubAllGlobals());

it("preserves a changed draft while an earlier ticket is uploading", async () => {
  const user = userEvent.setup();
  const client = new QueryClient();
  let complete = () => {};
  const reply = new Promise<Response>((resolve) => {
    complete = () =>
      resolve(Response.json({ documentId: "group" }, { status: 201 }));
  });
  const fetchMock = vi.fn().mockReturnValue(reply);
  vi.stubGlobal("fetch", fetchMock);
  const { container } = render(
    <QueryClientProvider client={client}>
      <TrainTicketBatchUpload tripId="trip" segmentId="train" />
    </QueryClientProvider>,
  );

  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Missing file input");
  await user.upload(
    input,
    new File(["pdf"], "group.pdf", { type: "application/pdf" }),
  );
  const seats = screen.getByRole("textbox", { name: "Places du billet" });
  await user.type(seats, "Voiture 4, place 12");
  await user.click(screen.getByRole("button", { name: "Ajouter au stock" }));
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(client.isMutating()).toBe(1);

  await user.clear(seats);
  await user.type(seats, "Voiture 5, place 13");
  complete();
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(seats).toHaveValue("Voiture 5, place 13");
  expect(screen.getByText("group.pdf")).toBeInTheDocument();
});
