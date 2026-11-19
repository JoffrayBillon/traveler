import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@traveler/i18n";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { DeleteParticipantDialog } from "./DeleteParticipantDialog";

afterEach(() => vi.unstubAllGlobals());

it("requires the current address again after cancelling and sends one deletion", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response('{"status":"deleted"}'));
  vi.stubGlobal("fetch", fetchMock);
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeleteParticipantDialog
        tripId="ski"
        userId="alex"
        email="alex@example.com"
        name="Alex Voyageur"
        isDisabled={false}
        onDeleted={onDeleted}
      />
    </QueryClientProvider>,
  );

  const trigger = screen.getByRole("button", { name: "Supprimer le voyageur" });
  await user.click(trigger);
  let dialog = within(screen.getByRole("alertdialog"));
  expect(dialog.getByRole("button", { name: "Annuler" })).toHaveFocus();
  const confirm = () =>
    dialog.getByRole("button", { name: "Supprimer définitivement" });
  const field = () =>
    dialog.getByRole("textbox", {
      name: "Ressaisissez l’adresse e-mail du voyageur",
    });
  expect(confirm()).toBeDisabled();
  await user.type(field(), "alex@example.com");
  expect(confirm()).toBeEnabled();
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(fetchMock).not.toHaveBeenCalled();

  await user.click(trigger);
  dialog = within(screen.getByRole("alertdialog"));
  expect(confirm()).toBeDisabled();
  await user.type(field(), "ALEX@example.com");
  await user.click(confirm());
  await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    "/api/trips/ski/participants/alex",
    expect.objectContaining({
      method: "DELETE",
      body: '{"email":"ALEX@example.com"}',
    }),
  );
});
