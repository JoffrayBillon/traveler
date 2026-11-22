import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TransportGroup } from "@traveler/api/transport/transport.types";
import "@traveler/i18n";
import { afterEach, expect, it, vi } from "vitest";
import { TransportGroupEditor } from "./TransportGroupEditor";

afterEach(() => vi.unstubAllGlobals());

it("moves an added shuttle before an existing return flight", {
  timeout: 10_000,
}, async () => {
  const user = userEvent.setup();
  const segment = {
    departureAt: null,
    arrivalAt: null,
    serviceReference: null,
  };
  const group: TransportGroup = {
    id: "group",
    tripId: "trip",
    name: "Paris",
    sourceCity: "Paris",
    normalizedCity: "paris",
    isDraft: false,
    outboundMeetingAt: null,
    outboundMeetingPlace: null,
    returnMeetingAt: null,
    returnMeetingPlace: null,
    travelers: [],
    segments: [
      {
        ...segment,
        id: "outbound",
        direction: "outbound",
        mode: "flight",
        origin: "Paris",
        destination: "Chambéry",
      },
      {
        ...segment,
        id: "return",
        direction: "return",
        mode: "flight",
        origin: "Chambéry",
        destination: "Paris",
      },
    ],
  };
  const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) =>
    Response.json({ ok: true }),
  );
  const onClose = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TransportGroupEditor
        tripId="trip"
        group={group}
        onClose={onClose}
        onMessage={vi.fn()}
      />
    </QueryClientProvider>,
  );

  await user.click(screen.getByRole("button", { name: /Ajouter.*retour/i }));
  const [flight, transfer] = screen.getAllByRole("group", {
    name: "Retour",
  });
  if (!flight || !transfer) throw new Error("Expected two return legs");
  await user.click(
    within(transfer).getByRole("button", { name: /Mode de transport/ }),
  );
  await user.click(screen.getByRole("option", { name: "Navette" }));
  fireEvent.change(
    within(transfer).getByRole("textbox", { name: "Départ de" }),
    {
      target: { value: "Hôtel" },
    },
  );
  fireEvent.change(
    within(transfer).getByRole("textbox", { name: "Destination" }),
    {
      target: { value: "Chambéry" },
    },
  );

  await user.click(
    within(transfer).getByRole("button", { name: "Monter cette étape" }),
  );
  expect(screen.getAllByRole("group", { name: "Retour" })).toEqual([
    transfer,
    flight,
  ]);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  const options = fetchMock.mock.calls[0]?.[1];
  expect(options?.method).toBe("PUT");
  expect(JSON.parse(String(options?.body)).segments).toMatchObject([
    { id: "outbound", direction: "outbound", mode: "flight" },
    {
      direction: "return",
      mode: "shuttle",
      origin: "Hôtel",
      destination: "Chambéry",
    },
    { id: "return", direction: "return", mode: "flight" },
  ]);
});
