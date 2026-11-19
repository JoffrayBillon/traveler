import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { queryKeys } from "@traveler/api/query-keys";
import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import "@traveler/i18n";
import { afterEach, expect, it, vi } from "vitest";
import { RoomConsentAlert } from "./RoomConsentAlert";
import { RoomingPanel } from "./RoomingPanel";

afterEach(() => vi.unstubAllGlobals());

const lea = { userId: "lea", firstName: "Léa", lastName: "Martin" };
const alex = { userId: "alex", firstName: "Alex", lastName: "Dupont" };

function renderPlan(
  rooms: RoomSummary[],
  travelers = [lea],
  client = new QueryClient(),
) {
  const fetchMock = vi.fn(async (input: string, request?: RequestInit) => {
    if (request?.method === "PUT") return Response.json({ status: "saved" });
    if (input.endsWith("/rooms?view=organizer"))
      return Response.json({ rooms });
    if (input.endsWith("/travelers")) {
      return Response.json({ travelers });
    }
    return Response.json({ requests: [] });
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <QueryClientProvider client={client}>
      <RoomingPanel tripId="test" userId="manager" view="organizer" />
    </QueryClientProvider>,
  );
  return fetchMock;
}

it("opens an assignment from a participant and finds room 47 by number", async () => {
  const user = userEvent.setup();
  const rooms = Array.from({ length: 47 }, (_, index) => ({
    id: `room-${index + 1}`,
    name: String(index + 1).padStart(2, "0"),
    capacity: 4,
    occupiedCount: 0,
    isLocked: false,
    occupants: [],
  }));
  const fetchMock = renderPlan(rooms, [lea, alex]);
  await screen.findByRole("button", { name: "Alex Dupont" });
  const search = screen.getByRole("searchbox", {
    name: "Rechercher un participant",
  });
  await user.type(search, "INCONNU");
  expect(screen.getByText(/Aucun utilisateur ne correspond/)).toBeVisible();
  await user.clear(search);
  await user.type(search, "LEA");
  expect(
    screen.queryByRole("button", { name: "Alex Dupont" }),
  ).not.toBeInTheDocument();
  const person = await screen.findByRole("button", { name: "Léa Martin" });
  person.focus();
  await user.keyboard("{Enter}");
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByRole("button", { name: /Léa Martin/ }),
  ).toBeVisible();
  const destination = within(dialog).getByRole("combobox", {
    name: "Chambre de destination",
  });
  await user.type(destination, "47");
  const option = await screen.findByRole("option", { name: /47.*0\/4/ });
  expect(
    screen.queryByRole("option", { name: /46.*0\/4/ }),
  ).not.toBeInTheDocument();
  await user.click(option);
  await user.click(within(dialog).getByRole("button", { name: "Attribuer" }));
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/test/rooms/room-47/participants/lea",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ expectedRoomId: null }),
      }),
    );
  });
});

it("updates the room after a drop while the requests refresh is still pending", async () => {
  const room = {
    id: "target",
    name: "47",
    capacity: 4,
    occupiedCount: 0,
    isLocked: false,
    occupants: [],
  };
  const fetchMock = renderPlan([room]);
  const person = await screen.findByRole("button", { name: "Léa Martin" });
  const row = person.closest("li");
  if (!row) throw new Error("Expected a draggable participant");

  let releaseRequests = () => {};
  const pendingRequests = new Promise<void>((resolve) => {
    releaseRequests = resolve;
  });
  const originalFetch = fetchMock.getMockImplementation();
  if (!originalFetch) throw new Error("Expected the plan fetch mock");
  fetchMock.mockImplementation(async (url, request) => {
    if (url.endsWith("/room-requests")) {
      await pendingRequests;
      return Response.json({ requests: [] });
    }
    if (url.endsWith("/rooms?view=organizer")) {
      return Response.json({
        rooms: [{ ...room, occupants: [lea], occupiedCount: 1 }],
      });
    }
    return originalFetch(url, request);
  });

  const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
  const target = screen.getByRole("article");
  fireEvent.dragStart(row, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });

  try {
    expect(
      await within(target).findByRole("button", { name: "Léa Martin" }),
    ).toBeVisible();
    expect(
      await screen.findByText("La répartition a été mise à jour."),
    ).toBeVisible();
    const calls = fetchMock.mock.calls.map(([url]) => url);
    expect(calls.filter((url) => url.endsWith("/travelers"))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith("/room-requests"))).toHaveLength(
      2,
    );
  } finally {
    releaseRequests();
  }
});

it("fetches only requests for the alert and does not poll while idle", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(async () => Response.json({ requests: [] }));
  vi.stubGlobal("fetch", fetchMock);

  try {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RoomConsentAlert tripId="test" userId="lea" />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_001);
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/trips/test/room-requests",
      expect.anything(),
    );
  } finally {
    vi.useRealTimers();
  }
});

it("refreshes the plan on demand and describes the last refresh on keyboard focus", async () => {
  const user = userEvent.setup();
  const fetchMock = renderPlan([], [lea]);
  await screen.findByRole("button", { name: "Léa Martin" });

  await user.tab();
  const refresh = screen.getByRole("button", {
    name: "Actualiser le plan des chambres",
  });
  expect(refresh).toHaveFocus();
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip).toHaveTextContent(/Dernière actualisation il y a/);
  expect(refresh).toHaveAccessibleDescription(tooltip.textContent ?? "");

  await user.keyboard("{Enter}");
  await waitFor(() => {
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/trips/test/rooms?view=organizer",
      "/api/trips/test/room-requests",
      "/api/trips/test/travelers",
      "/api/trips/test/rooms?view=organizer",
      "/api/trips/test/room-requests",
      "/api/trips/test/travelers",
    ]);
  });
});

it.each(["source moves", "destination opens"] as const)(
  "requires a new exchange selection if the %s while the dialog is open",
  async (change) => {
    const user = userEvent.setup();
    const client = new QueryClient();
    const source = {
      id: "source",
      name: "01",
      capacity: 1,
      occupiedCount: 1,
      occupants: [lea],
      isLocked: false,
    };
    const target = {
      id: "target",
      name: "47",
      capacity: 1,
      occupiedCount: 1,
      occupants: [alex],
      isLocked: false,
    };
    const spare = {
      id: "spare",
      name: "48",
      capacity: 2,
      occupiedCount: 0,
      occupants: [],
      isLocked: false,
    };
    const requests = renderPlan([source, target, spare], [lea, alex], client);
    await user.click(await screen.findByRole("button", { name: "Léa Martin" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(
      dialog.getByRole("combobox", { name: "Chambre de destination" }),
    );
    await user.click(
      await screen.findByRole("option", { name: /47.*Échange/ }),
    );
    await user.click(
      dialog.getByRole("button", { name: /Personne avec qui échanger/ }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Alex Dupont" }),
    );
    expect(
      dialog.getByRole("button", { name: "Échanger les places" }),
    ).toBeEnabled();

    act(() => {
      client.setQueryData(
        queryKeys.rooming("test", true),
        change === "source moves"
          ? [
              { ...source, occupiedCount: 0, occupants: [] },
              target,
              { ...spare, occupiedCount: 1, occupants: [lea] },
            ]
          : [source, { ...target, capacity: 2 }, spare],
      );
    });
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Le plan a changé",
    );
    expect(dialog.getByRole("button", { name: "Attribuer" })).toBeDisabled();
    expect(
      requests.mock.calls.some(([, request]) => request?.method === "PUT"),
    ).toBe(false);
  },
);

it.each(["dialog", "drag"] as const)(
  "swaps two occupants of full rooms via %s",
  async (method) => {
    const user = userEvent.setup();
    const fetchMock = renderPlan(
      [
        {
          id: "source",
          name: "01",
          capacity: 1,
          occupiedCount: 1,
          occupants: [lea],
          isLocked: true,
        },
        {
          id: "target",
          name: "47",
          capacity: 1,
          occupiedCount: 1,
          occupants: [alex],
          isLocked: true,
        },
      ],
      [lea, alex],
    );
    const person = await screen.findByRole("button", { name: "Léa Martin" });
    if (method === "drag") {
      const dataTransfer = {
        setData: vi.fn(),
        effectAllowed: "",
        dropEffect: "",
      };
      const row = person.closest("li");
      if (!row) throw new Error("Expected a draggable occupant row");
      const target = screen.getByRole("button", { name: "Alex Dupont" });
      fireEvent.dragStart(row, { dataTransfer });
      fireEvent.dragOver(target, { dataTransfer });
      expect(target).toHaveAttribute("data-exchange-target", "true");
      fireEvent.drop(target, { dataTransfer });
    } else {
      await user.click(person);
      const dialog = await screen.findByRole("dialog");
      const destination = within(dialog).getByRole("combobox", {
        name: "Chambre de destination",
      });
      await user.click(destination);
      expect(
        screen.queryByRole("option", { name: /^01/ }),
      ).not.toBeInTheDocument();
      await user.click(
        await screen.findByRole("option", { name: /47.*Échange/ }),
      );
      const submit = within(dialog).getByRole("button", {
        name: "Échanger les places",
      });
      expect(submit).toBeDisabled();
      await user.click(
        within(dialog).getByRole("button", {
          name: /Personne avec qui échanger/,
        }),
      );
      await user.click(
        await screen.findByRole("option", { name: "Alex Dupont" }),
      );
      await user.click(submit);
    }
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/trips/test/rooms/target/participants/lea",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            expectedRoomId: "source",
            exchangeWithUserId: "alex",
          }),
        }),
      );
    });
  },
);
