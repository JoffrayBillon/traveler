import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import "@traveler/i18n";
import { expect, it, vi } from "vitest";
import { TravelerRooming } from "./TravelerRooming";

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
  expect(
    screen.getByRole("button", { name: "Déverrouiller la chambre" }),
  ).toBeEnabled();
  expect(screen.getByText(/Léa Voyageur/)).toBeVisible();

  rerender(renderRooming(ownRoom));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: planName }));
  plan = screen.getByRole("dialog");
  expect(
    within(plan).getByRole("button", { name: /Sam Voyageur/ }),
  ).toBeEnabled();
});
