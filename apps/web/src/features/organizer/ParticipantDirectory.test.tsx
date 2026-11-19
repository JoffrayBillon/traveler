import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantDirectory } from "./ParticipantDirectory";

afterEach(() => vi.unstubAllGlobals());

describe("ParticipantDirectory", () => {
  it("combines directory filters with search and opens the matching traveler profile", async () => {
    const user = userEvent.setup();
    const participant = {
      userId: "traveler-1",
      firstName: "Alex",
      lastName: "Voyageur",
      email: "alex@example.com",
      role: "traveler",
      gender: "M",
      genderConfirmed: true,
      dietaryRequirements: "Végétarien",
      allergens: null,
      profileCompletedAt: "2026-10-30T12:00:00.000Z",
      lastLoginAt: null,
      paymentStatus: "paid",
      amountPaidMinor: 10000,
      amountDueMinor: 0,
      paymentNeedsReview: false,
      emergencyContactFirstName: "Sam",
      emergencyContactLastName: "Contact",
      emergencyContactPhone: "+33612345678",
      personalPhone: "+33645678901",
      activityProfile: "ski",
      skiDayThree: true,
      transportChoice: "group",
      groupId: "group-1",
      carpoolRole: "none",
      carpoolDriverUserId: null,
      transportMode: "train",
      departureCity: "Paris",
      outboundDateTime: null,
      outboundTimezone: "Europe/Paris",
      outboundMeetingTime: null,
      outboundDepartureTime: null,
      outboundLocation: "Gare de Lyon",
      outboundReference: null,
      outboundSeat: "12A",
      returnDateTime: null,
      returnTimezone: "Europe/Paris",
      returnMeetingTime: null,
      returnDepartureTime: null,
      returnLocation: null,
      returnReference: null,
      returnSeat: null,
      carpoolPreference: null,
      parkingPreference: null,
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        return {
          ok: true,
          json: async () =>
            url.includes("/travelers")
              ? {
                  travelers: [
                    participant,
                    {
                      ...participant,
                      userId: "traveler-2",
                      firstName: "Léa",
                      lastName: "Martin",
                      email: "lea@example.com",
                      role: "companion",
                      paymentStatus: "unpaid",
                      activityProfile: "spa",
                      transportChoice: "none",
                      groupId: null,
                    },
                  ],
                }
              : {
                  groups: [
                    {
                      id: "group-1",
                      tripId: "trip-1",
                      name: "Paris Ski",
                      sourceCity: "Paris",
                      normalizedCity: "paris",
                      isDraft: false,
                      outboundMeetingAt: null,
                      outboundMeetingPlace: null,
                      returnMeetingAt: null,
                      returnMeetingPlace: null,
                      segments: [],
                      travelers: [],
                    },
                  ],
                  participants: [],
                  drivers: [],
                  self: null,
                },
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ParticipantDirectory tripId="trip-1" isManager />
      </QueryClientProvider>,
    );

    const transport = /Affectation.*transport/i;
    await user.click(await screen.findByRole("button", { name: transport }));
    await user.click(
      await screen.findByRole("option", { name: "Paris Ski · Paris" }),
    );
    expect(screen.getByRole("button", { name: /Alex Voyageur/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Léa Martin/ }),
    ).not.toBeInTheDocument();

    for (const [filter, option] of [
      [/Paiement/, /Non payé/i],
      [/Rôle/, /^Accompagnateur$/i],
      [/Déclinaison/, /^Spa$/],
      [transport, /^Sans transport groupé$/],
    ] as const) {
      await user.click(await screen.findByRole("button", { name: filter }));
      await user.click(await screen.findByRole("option", { name: option }));
    }
    expect(screen.getByRole("button", { name: /Léa Martin/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Alex Voyageur/ }),
    ).not.toBeInTheDocument();
    const search = screen.getByRole("searchbox", {
      name: /Rechercher un participant/i,
    });
    await user.type(search, "alex");
    expect(screen.getByText(/Aucun utilisateur ne correspond/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Réinitialiser les filtres" }),
    );
    await user.click(
      await screen.findByRole("button", { name: /Alex Voyageur/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByDisplayValue("Végétarien")).toBeInTheDocument();
    expect(
      within(dialog).getByDisplayValue("alex@example.com"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /Paris Ski · Paris/ }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Supprimer le voyageur" }),
    );
    const confirmation = screen.getByRole("alertdialog");
    expect(within(confirmation).getByText("alex@example.com")).toBeVisible();
    await user.click(
      within(confirmation).getByRole("button", { name: "Annuler" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(dialog).toBeVisible();

    const personalPhone = within(dialog).getByRole("textbox", {
      name: "Téléphone personnel",
    });
    expect(personalPhone).toHaveValue("6 45 67 89 01");
    await user.clear(personalPhone);
    await user.click(
      within(dialog).getByRole("button", {
        name: "Enregistrer les modifications",
      }),
    );
    await waitFor(() => {
      const request = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith("/admin-profile"),
      );
      expect(JSON.parse(String(request?.[1]?.body)).profile.personalPhone).toBe(
        "",
      );
    });
  });
});
