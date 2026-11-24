import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import "@traveler/i18n";
import { afterEach, expect, it, vi } from "vitest";
import { TravelerRooming } from "./TravelerRooming";

afterEach(() => vi.unstubAllGlobals());

function room(id: string, isLocked: boolean, firstName: string): RoomSummary {
  return {
    id,
    name: id,
    capacity: 1,
    occupiedCount: 1,
    isLocked,
    occupants: [{ userId: firstName, firstName, lastName: "Voyageur" }],
  };
}

it("only offers exchanges in unlocked rooms and closes the plan when one's own room locks", async () => {
  const user = userEvent.setup();
  const ownRoom = room("01", false, "Léa");
  const lockedRoom = room("02", true, "Alex");
  const openRoom = room("03", false, "Sam");
  const client = new QueryClient();
  const onMessage = vi.fn();
  const renderRooming = (currentRoom: RoomSummary) => (
    <QueryClientProvider client={client}>
      <TravelerRooming
        tripId="ski"
        userId="Léa"
        ownRoom={currentRoom}
        rooms={[currentRoom, lockedRoom, openRoom]}
        onMessage={onMessage}
      />
    </QueryClientProvider>
  );
  const { rerender } = render(renderRooming(ownRoom));
  const planName = "Voir le plan des chambres";
  await user.click(screen.getByRole("button", { name: planName }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: planName })).toHaveFocus(),
  );
  await user.keyboard("{Enter}");
  let plan = screen.getByRole("dialog");
  expect(within(plan).getByText("03")).toBeVisible();
  expect(
    within(plan).getByRole("button", { name: /Sam Voyageur/ }),
  ).toBeEnabled();
  expect(within(plan).queryByText("02")).not.toBeInTheDocument();
  expect(within(plan).queryByText("Alex Voyageur")).not.toBeInTheDocument();

  rerender(renderRooming({ ...ownRoom, isLocked: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: planName }),
  ).not.toBeInTheDocument();
  const unlock = screen.getByRole("button", {
    name: "Déverrouiller la chambre",
  });
  expect(unlock).toBeEnabled();
  expect(unlock).toHaveFocus();
  expect(screen.getByText(/Léa Voyageur/)).toBeVisible();

  rerender(renderRooming(ownRoom));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: planName }));
  plan = screen.getByRole("dialog");
  expect(
    within(plan).getByRole("button", { name: /Sam Voyageur/ }),
  ).toBeEnabled();
});

it.each([
  ["applied", "Votre place dans la chambre 03 est confirmée."],
  ["pending", "Votre demande a été envoyée aux occupants de la chambre 03."],
] as const)(
  "lets an unassigned traveler take a free place and announces %s",
  async (status, message) => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ request: { status } }, { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const onMessage = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TravelerRooming
          tripId="ski"
          userId="Léa"
          ownRoom={undefined}
          rooms={[
            room("01", false, "Alex"),
            { ...room("02", true, "Jo"), capacity: 2 },
            { ...room("03", false, "Sam"), capacity: 3 },
          ]}
          onMessage={onMessage}
        />
      </QueryClientProvider>,
    );
    const trigger = screen.getByRole("button", {
      name: "Voir le plan des chambres",
    });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: /échange/ }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getAllByRole("button", { name: /Prendre une place/ }),
    ).toHaveLength(1);
    const takePlace = within(dialog).getByRole("button", {
      name: "Prendre une place dans la chambre 03",
    });
    takePlace.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith(message));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/trips/ski/room-requests");
    expect(JSON.parse(init.body)).toEqual({
      moves: [{ userId: "Léa", expectedRoomId: null, targetRoomId: "03" }],
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  },
);
