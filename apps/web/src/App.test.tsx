import { focusManager } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { queryClient } from "@traveler/api/query-client";
import { queryKeys } from "@traveler/api/query-keys";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function mockResponse(
  status: number,
  body: unknown = {},
  headers = new Headers(),
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers,
  };
}

beforeEach(() => {
  queryClient.clear();
  window.history.pushState({}, "", "/");
  window.localStorage.removeItem("traveler-theme");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(401)));
});

afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  vi.unstubAllGlobals();
});

describe("application shell", () => {
  it("provides a main landmark and a keyboard skip link", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: /La montagne/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    screen.getByRole("link", { name: "Aller au contenu" }).focus();
    expect(
      screen.getByRole("link", { name: "Aller au contenu" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("link", { name: "Aller au contenu" }),
    ).toHaveAttribute("href", "#main");
    await user.keyboard("{Enter}");
    expect(window.location.hash).toBe("#main");
  });

  it("defaults to the system theme and switches preferences accessibly", async () => {
    const user = userEvent.setup();
    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        url === "/api/me"
          ? Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                user: {
                  id: "user-1",
                  name: "Mina Manager",
                  email: "mina@example.com",
                },
                trips: [
                  { tripId: "trip-1", tripName: "Ski 2027", role: "manager" },
                ],
              }),
            })
          : Promise.resolve(mockResponse(200)),
      ),
    );
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina." }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await user.click(
      screen.getByRole("button", { name: "Compte de Mina Manager" }),
    );
    const system = screen.getByRole("radio", { name: "Système" });
    const dark = screen.getByRole("radio", { name: "Sombre" });
    const light = screen.getByRole("radio", { name: "Clair" });
    expect(system).toHaveAttribute("aria-checked", "true");
    await user.click(light);
    expect(light).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await user.click(dark);
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await user.click(system);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("has no detectable semantic accessibility violations", async () => {
    const { container } = render(<App />);
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("provides route navigation for a signed-in member", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: "user-1",
          name: "Mina Manager",
          email: "manager@example.com",
        },
        trips: [{ tripId: "trip-1", tripName: "Ski 2027", role: "manager" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mes voyages" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Ski 2027/ })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Compte de Mina Manager" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Profil et préférences" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("manager@example.com")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Se déconnecter" }),
    ).toBeInTheDocument();
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("lets companions update a participant's grouped transport", async () => {
    const user = userEvent.setup();
    const participant = {
      userId: "traveler-1",
      firstName: "Alex",
      lastName: "Voyageur",
      email: "alex@example.com",
      role: "traveler",
      gender: "M",
      genderConfirmed: true,
      dietaryRequirements: null,
      allergens: null,
      profileCompletedAt: null,
      lastLoginAt: null,
      paymentStatus: null,
      amountPaidMinor: null,
      amountDueMinor: null,
      paymentNeedsReview: false,
      emergencyContactFirstName: null,
      emergencyContactLastName: null,
      emergencyContactPhone: null,
      activityProfile: "ski",
      skiDayThree: false,
      transportChoice: "unconfirmed",
      groupId: null,
      carpoolRole: "none",
      carpoolDriverUserId: null,
    };
    const group = {
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
    };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/me")
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            user: {
              id: "staff-1",
              name: "Léa Staff",
              email: "staff@example.com",
            },
            trips: [
              { tripId: "trip-1", tripName: "Ski 2027", role: "companion" },
            ],
          }),
        });
      if (url === "/api/trips/trip-1/travelers")
        return Promise.resolve({
          ok: true,
          json: async () => ({
            travelers: [participant],
          }),
        });
      if (url === "/api/trips/trip-1/transport")
        return Promise.resolve({
          ok: true,
          json: async () => ({
            groups: [group],
            participants: [],
            drivers: [],
            self: null,
          }),
        });
      return Promise.resolve(mockResponse(200));
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/trips/trip-1/organize");
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: /Alex Voyageur/ }),
    );
    const dialog = await screen.findByRole("dialog");
    const emailField = within(dialog).getByRole("textbox", {
      name: "Adresse e-mail",
    });
    expect(emailField).toBeDisabled();
    await user.click(
      within(dialog).getByRole("button", { name: /Affectation du transport/ }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Paris Ski · Paris" }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: "Enregistrer les modifications",
      }),
    );

    const saveCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url === "/api/trips/trip-1/participants/traveler-1/admin-profile" &&
        (options as RequestInit | undefined)?.method === "PUT",
    );
    if (!saveCall) throw new Error("Expected the participant update request.");
    expect(
      JSON.parse((saveCall[1] as RequestInit).body as string),
    ).toMatchObject({
      details: { transportChoice: "group", groupId: "group-1" },
    });
  });

  it("requests a sign-in link and does not reveal whether the email is invited", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        url === "/api/me"
          ? Promise.resolve(mockResponse(401))
          : Promise.resolve(mockResponse(200)),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await user.type(
      await screen.findByRole("textbox", { name: "Votre adresse e-mail" }),
      "traveler@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Recevoir mon lien de connexion" }),
    );

    const signInCall = fetchMock.mock.calls.find(
      ([url]) => url === "/api/auth/sign-in/magic-link",
    );
    if (!signInCall) throw new Error("Expected the magic-link request.");
    expect(signInCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "traveler@example.com",
          callbackURL: `${window.location.origin}/`,
        }),
      }),
    );
    expect(
      new Headers((signInCall[1] as RequestInit).headers).get("Content-Type"),
    ).toBe("application/json");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Si cette adresse est autorisée, son lien de connexion est affiché dans le terminal de l’API locale.",
    );
    const retryButton = screen.getByRole("button", {
      name: "Réessayez dans 30 s",
    });
    expect(retryButton).toBeDisabled();
    await user.click(retryButton);
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/auth/sign-in/magic-link",
      ),
    ).toHaveLength(1);
  });

  it("announces an unavailable sign-in service accessibly", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((url: string) =>
          url === "/api/me"
            ? Promise.resolve(mockResponse(401))
            : Promise.resolve(mockResponse(503)),
        ),
    );
    render(<App />);

    await user.type(
      await screen.findByRole("textbox", { name: "Votre adresse e-mail" }),
      "traveler@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Recevoir mon lien de connexion" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La connexion est momentanément indisponible.",
    );
  });

  it("shows the retry delay when sign-in is rate limited", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        url === "/api/me"
          ? Promise.resolve(mockResponse(401))
          : Promise.resolve({
              ok: false,
              status: 429,
              headers: new Headers({ "Retry-After": "45" }),
              json: async () => ({}),
            }),
      ),
    );
    render(<App />);

    await user.type(
      await screen.findByRole("textbox", { name: "Votre adresse e-mail" }),
      "traveler@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Recevoir mon lien de connexion" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Trop de demandes. Réessayez dans 45 secondes.",
    );
    expect(
      screen.getByRole("button", { name: "Réessayez dans 45 s" }),
    ).toBeDisabled();
  });

  it("re-enables sign-in based on elapsed time when the tab regains focus", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            url === "/api/me" ? mockResponse(401) : mockResponse(200),
          ),
        ),
    );
    render(<App />);
    await screen.findByRole("textbox", { name: "Votre adresse e-mail" });

    fireEvent.change(
      screen.getByRole("textbox", { name: "Votre adresse e-mail" }),
      {
        target: { value: "traveler@example.com" },
      },
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Recevoir mon lien de connexion" })
        .closest("form") as HTMLFormElement,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      screen.getByRole("button", { name: "Réessayez dans 30 s" }),
    ).toBeDisabled();

    await act(async () => {
      vi.setSystemTime(Date.now() + 31_000);
      window.dispatchEvent(new Event("focus"));
    });

    expect(
      screen.getByRole("button", { name: "Recevoir mon lien de connexion" }),
    ).toBeEnabled();
  });

  it("shows only the signed-in member's trips and supports signing out", async () => {
    const user = userEvent.setup();
    let isSignedOut = false;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/sign-out") {
        isSignedOut = true;
        return Promise.resolve(mockResponse(200));
      }
      if (url !== "/api/me") return Promise.resolve(mockResponse(200));
      return isSignedOut
        ? Promise.resolve(mockResponse(401))
        : Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              user: {
                id: "user-1",
                name: "Mina Manager",
                email: "manager@example.com",
              },
              trips: [
                { tripId: "trip-1", tripName: "Ski 2027", role: "manager" },
              ],
            }),
          });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gestionnaire")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Compte de Mina Manager" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Se déconnecter" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sign-out",
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /La montagne/,
      }),
    ).toBeInTheDocument();
  });

  it("opens a trip workspace with its activity, transport details and private ticket links", async () => {
    const user = userEvent.setup();
    const profile = {
      user: {
        id: "user-1",
        name: "Alex Voyageur",
        email: "traveler@example.com",
      },
      trips: [
        { tripId: "trip-1", tripName: "Ski 2027", role: "traveler" as const },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/me") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => profile,
          });
        }
        if (url === "/api/trips/trip-1/traveler") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              trip: { id: "trip-1", name: "Ski 2027" },
              traveler: {
                firstName: "Alex",
                lastName: "Voyageur",
                gender: "M",
                role: "traveler",
              },
              details: {
                activityProfile: "ski",
                skiDayThree: true,
                transportMode: "train",
                outboundDateTime: "2027-02-15T07:30:00.000Z",
                outboundTimezone: "Europe/Paris",
                outboundLocation: "Paris Gare de Lyon",
                outboundReference: "ABC123",
                outboundSeat: "12A",
                returnDateTime: null,
                returnTimezone: null,
                returnLocation: null,
                returnReference: null,
                returnSeat: null,
                carpoolPreference: null,
                parkingPreference: null,
                updatedAt: null,
              },
              tickets: [
                {
                  id: "ticket-1",
                  kind: "outbound",
                  originalName: "billet-aller.pdf",
                  size: 51200,
                  createdAt: "2026-10-31T10:00:00.000Z",
                },
              ],
            }),
          });
        }
        if (url === "/api/trips/trip-1/transport")
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              groups: [
                {
                  id: "group-1",
                  tripId: "trip-1",
                  name: "Paris Ski",
                  sourceCity: "Paris",
                  normalizedCity: "paris",
                  isDraft: false,
                  outboundMeetingAt: null,
                  outboundMeetingPlace: "Gare de Lyon",
                  returnMeetingAt: null,
                  returnMeetingPlace: null,
                  segments: [
                    {
                      id: "segment-1",
                      direction: "outbound",
                      mode: "train",
                      origin: "Paris",
                      destination: "Moûtiers",
                      departureAt: "2027-02-15T07:30:00.000Z",
                      arrivalAt: null,
                      serviceReference: "ABC123",
                    },
                  ],
                  travelers: [],
                },
              ],
              participants: [],
              drivers: [],
              self: {
                transportChoice: "group",
                groupId: "group-1",
                carpoolRole: "none",
                carpoolDriverUserId: null,
              },
            }),
          });
        return Promise.resolve(mockResponse(200));
      }),
    );
    render(<App />);

    await user.click(await screen.findByRole("link", { name: /Ski 2027/ }));

    expect(
      await screen.findByRole("heading", { name: "Votre séjour" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Forfait ski 3 jours")).toBeInTheDocument();
    expect(await screen.findByText("Paris Ski")).toBeInTheDocument();
    expect(
      await screen.findByText(/Train · Paris → Moûtiers/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Gare de Lyon/)).toBeInTheDocument();
    expect(screen.getByText("billet-aller.pdf · 50 Ko")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Télécharger Aller : billet-aller.pdf",
      }),
    ).toHaveAttribute("href", "/api/trips/trip-1/tickets/ticket-1");
  });

  it("revalidates the session on focus and clears the profile after a 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: "user-1",
            name: "Mina Manager",
            email: "manager@example.com",
          },
          trips: [{ tripId: "trip-1", tripName: "Ski 2027", role: "manager" }],
        }),
      })
      .mockResolvedValueOnce(mockResponse(401));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina." }),
    ).toBeInTheDocument();
    await queryClient.invalidateQueries({
      queryKey: queryKeys.me,
      refetchType: "none",
    });
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    expect(
      await screen.findByRole("heading", {
        name: /La montagne/,
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the profile when the session has no trip membership", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: "user-1",
            name: "Mina Manager",
            email: "manager@example.com",
          },
          trips: [{ tripId: "trip-1", tripName: "Ski 2027", role: "manager" }],
        }),
      })
      .mockResolvedValueOnce(mockResponse(403));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina." }),
    ).toBeInTheDocument();
    await queryClient.invalidateQueries({
      queryKey: queryKeys.me,
      refetchType: "none",
    });
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(
      await screen.findByRole("heading", {
        name: /La montagne/,
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not restore a stale profile response after signing out", async () => {
    const user = userEvent.setup();
    let resolveStaleProfile!: (profile: {
      user: { id: string; name: string; email: string };
      trips: { tripId: string; tripName: string; role: "manager" }[];
    }) => void;
    const staleProfileBody = new Promise<{
      user: { id: string; name: string; email: string };
      trips: { tripId: string; tripName: string; role: "manager" }[];
    }>((resolve) => {
      resolveStaleProfile = resolve;
    });
    const profile = {
      user: {
        id: "user-1",
        name: "Mina Manager",
        email: "manager@example.com",
      },
      trips: [
        { tripId: "trip-1", tripName: "Ski 2027", role: "manager" as const },
      ],
    };
    const staleJson = vi.fn(() => staleProfileBody);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => profile,
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: staleJson })
      .mockResolvedValueOnce(mockResponse(200))
      .mockResolvedValueOnce(mockResponse(401));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina." }),
    ).toBeInTheDocument();
    await queryClient.invalidateQueries({
      queryKey: queryKeys.me,
      refetchType: "none",
    });
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(staleJson).toHaveBeenCalledOnce());
    await user.click(
      screen.getByRole("button", { name: "Compte de Mina Manager" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Se déconnecter" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /La montagne/,
      }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveStaleProfile(profile);
      await staleProfileBody;
    });

    expect(
      screen.getByRole("heading", {
        name: /La montagne/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Gestionnaire")).not.toBeInTheDocument();
  });
});
