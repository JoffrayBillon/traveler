import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@traveler/i18n";
import { afterEach, expect, it, vi } from "vitest";
import { TrainTicketPoolEditor } from "./TrainTicketPoolEditor";

afterEach(() => vi.unstubAllGlobals());

it("shows the room and seat before publication and reloads the published pool", async () => {
  const user = userEvent.setup();
  let published = false;
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/publish")) {
      expect(options?.body).toEqual(JSON.stringify({ snapshot: "initial" }));
      published = true;
      return Response.json({ status: "published" });
    }
    return Response.json({
      documents: [{ id: "group", originalName: "groupe.pdf" }],
      seats: [
        {
          id: "seat-12",
          label: "Voiture 4, place 12",
          assignedName: "Alex Martin",
          roomNumber: "01",
          isNew: !published,
        },
      ],
      snapshot: published ? "published" : "initial",
      hasChanges: !published,
      unassigned: 0,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TrainTicketPoolEditor tripId="trip" segmentId="paris-out" />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("À publier")).toBeVisible();
  expect(screen.getByText("Voiture 4, place 12")).toBeVisible();
  expect(screen.getByText("Alex Martin · Chambre 01")).toBeVisible();
  const publish = screen.getByRole("button", {
    name: "Publier les attributions",
  });
  await user.click(publish);
  await waitFor(() =>
    expect(screen.queryByText("À publier")).not.toBeInTheDocument(),
  );
  expect(publish).toBeDisabled();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/api/trips/trip/train-tickets/paris-out",
    "/api/trips/trip/train-tickets/paris-out/publish",
    "/api/trips/trip/train-tickets/paris-out",
  ]);
});
