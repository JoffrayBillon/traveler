import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@traveler/i18n";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
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
  await waitFor(() => expect(trigger).toHaveFocus());

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

it("keeps the confirmation open during deletion and after an address conflict", async () => {
  const user = userEvent.setup();
  let complete = () => {};
  const delayed = new Promise<Response>((resolve) => {
    complete = () =>
      resolve(
        Response.json(
          { error: "participant_confirmation_mismatch" },
          { status: 409 },
        ),
      );
  });
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(delayed)
    .mockResolvedValueOnce(Response.json({ status: "deleted" }));
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
  await user.click(
    screen.getByRole("button", { name: "Supprimer le voyageur" }),
  );
  const dialog = within(screen.getByRole("alertdialog"));
  const field = dialog.getByRole("textbox");
  const confirm = dialog.getByRole("button", {
    name: "Supprimer définitivement",
  });
  const accessibility = await axe.run(screen.getByRole("alertdialog"), {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(accessibility.violations).toEqual([]);
  await user.type(field, "alex@example.com");
  await user.click(confirm);
  await waitFor(() => expect(confirm).toHaveAttribute("data-pending"));
  expect(field).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("alertdialog")).toBeVisible();
  complete();
  expect(await dialog.findByRole("alert")).toHaveTextContent(
    "L’adresse e-mail a changé",
  );
  expect(onDeleted).not.toHaveBeenCalled();
  await user.click(confirm);
  await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
});
