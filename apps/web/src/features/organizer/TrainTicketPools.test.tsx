import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TransportGroup } from "@traveler/api/transport/transport.types";
import "@traveler/i18n";
import { afterEach, expect, it, vi } from "vitest";
import { TrainTicketPools } from "./TrainTicketPools";

afterEach(() => vi.unstubAllGlobals());

it("loads and shows the selected train direction without mixing its coverage", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async (path: string) => {
    const isReturn = path.endsWith("/return-train/imports");
    if (!path.endsWith("/imports")) {
      return Response.json({ documents: [], seats: [], unassigned: 0 });
    }
    return Response.json({
      snapshot: "demo",
      documents: [],
      travelers: [],
      coverage: {
        expected: 1,
        ready: 0,
        published: 0,
        missing: [{ id: "one", name: isReturn ? "Retour Test" : "Aller Test" }],
      },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  const group: TransportGroup = {
    id: "paris",
    tripId: "trip",
    name: "Paris ski",
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
        id: "outbound-train",
        direction: "outbound",
        mode: "train",
        origin: "Paris",
        destination: "Lyon",
        departureAt: null,
        arrivalAt: null,
        serviceReference: null,
      },
      {
        id: "return-train",
        direction: "return",
        mode: "train",
        origin: "Lyon",
        destination: "Paris",
        departureAt: null,
        arrivalAt: null,
        serviceReference: null,
      },
    ],
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TrainTicketPools tripId="trip" groups={[group]} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Aller Test")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Trajet/ }));
  await user.click(screen.getByRole("option", { name: "Retour" }));
  expect(await screen.findByText("Retour Test")).toBeVisible();
  expect(screen.queryByText("Aller Test")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/trips/trip/train-tickets/return-train/imports",
    expect.anything(),
  );
});
