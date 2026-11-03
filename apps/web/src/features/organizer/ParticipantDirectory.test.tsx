import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantDirectory } from "./ParticipantDirectory";

afterEach(() => vi.unstubAllGlobals());

describe("ParticipantDirectory", () => {
  it("shows one searchable user list and opens the full traveler profile", async () => {
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () =>
          url.includes("/travelers")
            ? { travelers: [participant] }
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
    });
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ParticipantDirectory tripId="trip-1" isManager />
      </QueryClientProvider>,
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
  });
});
