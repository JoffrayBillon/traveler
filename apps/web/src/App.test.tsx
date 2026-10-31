import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401 }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("application shell", () => {
  it("provides a main landmark and a keyboard skip link", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent(
      "Votre espace vous attend",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    await user.tab();
    expect(
      screen.getByRole("link", { name: "Aller au contenu" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("link", { name: "Aller au contenu" }),
    ).toHaveAttribute("href", "#main");
    await user.keyboard("{Enter}");
    expect(window.location.hash).toBe("#main");
  });

  it("changes the theme with the keyboard and exposes the toggle state", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.tab();
    await user.tab();
    await user.tab();
    const toggle = screen.getByRole("button", {
      name: "Activer le thème sombre",
    });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: "Activer le thème clair" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await user.keyboard(" ");
    expect(
      screen.getByRole("button", { name: "Activer le thème sombre" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("has no detectable semantic accessibility violations", async () => {
    const { container } = render(<App />);
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("provides accessible trip and account tabs for a signed-in member", async () => {
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
      await screen.findByRole("heading", { name: "Bonjour Mina Manager." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mes voyages" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "Ski 2027" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Mon compte" }));
    expect(screen.getByText("manager@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Se déconnecter" }),
    ).toBeInTheDocument();
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("lets companions save transport details for a participant", async () => {
    const user = userEvent.setup();
    const travelerDetails = {
      activityProfile: "ski",
      skiDayThree: false,
      transportMode: "train",
      departureCity: null,
      outboundDateTime: null,
      outboundTimezone: null,
      outboundMeetingTime: null,
      outboundDepartureTime: null,
      outboundLocation: null,
      outboundReference: null,
      outboundSeat: null,
      returnDateTime: null,
      returnTimezone: null,
      returnMeetingTime: null,
      returnDepartureTime: null,
      returnLocation: null,
      returnReference: null,
      returnSeat: null,
      carpoolPreference: null,
      parkingPreference: null,
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
      if (url.endsWith("/traveler"))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            trip: { id: "trip-1", name: "Ski 2027" },
            traveler: {
              firstName: "Léa",
              lastName: "Staff",
              gender: "F",
              role: "companion",
            },
            details: travelerDetails,
            tickets: [],
          }),
        });
      if (url.endsWith("/rooms"))
        return Promise.resolve({ ok: true, json: async () => ({ rooms: [] }) });
      if (url.endsWith("/room-requests"))
        return Promise.resolve({
          ok: true,
          json: async () => ({ requests: [] }),
        });
      if (url.endsWith("/travelers"))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            travelers: [
              {
                userId: "traveler-1",
                firstName: "Alex",
                lastName: "Voyageur",
                email: "alex@example.com",
                role: "traveler",
                ...travelerDetails,
              },
            ],
          }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await user.click(await screen.findByRole("tab", { name: "Mon voyage" }));
    expect(
      await screen.findByRole("heading", {
        name: "Informations de voyageur et de transport",
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Voyageur à mettre à jour/ }),
    );
    await user.click(
      await screen.findByRole("option", { name: /Alex Voyageur/ }),
    );
    await user.type(
      await screen.findByRole("textbox", { name: "Ville de départ" }),
      "Lyon",
    );
    await user.click(
      screen.getByRole("button", { name: "Enregistrer les informations" }),
    );

    const saveCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url === "/api/trips/trip-1/travelers/traveler-1/details" &&
        (options as RequestInit | undefined)?.method === "PUT",
    );
    if (!saveCall) throw new Error("Expected the traveler details update.");
    expect(
      JSON.parse((saveCall[1] as RequestInit).body as string),
    ).toMatchObject({
      activityProfile: "ski",
      transportMode: "train",
      departureCity: "Lyon",
      carpoolPreference: null,
      parkingPreference: null,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Les informations de voyage ont été mises à jour.",
    );
  });

  it("requests a sign-in link and does not reveal whether the email is invited", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        url === "/api/me"
          ? Promise.resolve({ status: 401 })
          : Promise.resolve({ ok: true, status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await user.type(
      await screen.findByRole("textbox", { name: "Adresse e-mail" }),
      "traveler@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Recevoir mon lien" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "traveler@example.com",
        callbackURL: `${window.location.origin}/`,
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Si cette adresse est autorisée, un lien de connexion vient d’être envoyé.",
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
            ? Promise.resolve({ status: 401 })
            : Promise.resolve({ ok: false, status: 503 }),
        ),
    );
    render(<App />);

    await user.type(
      await screen.findByRole("textbox", { name: "Adresse e-mail" }),
      "traveler@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Recevoir mon lien" }));

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
          ? Promise.resolve({ status: 401 })
          : Promise.resolve({
              ok: false,
              status: 429,
              headers: new Headers({ "Retry-After": "45" }),
            }),
      ),
    );
    render(<App />);

    await user.type(
      await screen.findByRole("textbox", { name: "Adresse e-mail" }),
      "traveler@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Recevoir mon lien" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Trop de demandes. Réessayez dans 45 secondes.",
    );
    expect(
      screen.getByRole("button", { name: "Réessayez dans 45 s" }),
    ).toBeDisabled();
  });

  it("re-enables sign-in based on elapsed time when the tab regains focus", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            url === "/api/me" ? { status: 401 } : { ok: true, status: 200 },
          ),
        ),
    );
    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Adresse e-mail" }), {
      target: { value: "traveler@example.com" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Recevoir mon lien" })
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
      screen.getByRole("button", { name: "Recevoir mon lien" }),
    ).toBeEnabled();
  });

  it("shows only the signed-in member's trips and supports signing out", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      url === "/api/me"
        ? Promise.resolve({
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
          })
        : Promise.resolve({ ok: true, status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina Manager." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gestionnaire")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Mon compte" }));
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-out", {
      method: "POST",
    });
    expect(
      await screen.findByRole("heading", {
        name: "Votre espace vous attend.",
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
        return Promise.resolve({ ok: true, status: 200 });
      }),
    );
    render(<App />);

    await user.click(await screen.findByRole("tab", { name: "Mon voyage" }));

    expect(
      await screen.findByRole("heading", { name: "Votre séjour" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Forfait ski 3 jours")).toBeInTheDocument();
    expect(screen.getByText("Train")).toBeInTheDocument();
    expect(
      screen.getByText("Paris Gare de Lyon · Réf. ABC123 · Place 12A"),
    ).toBeInTheDocument();
    expect(screen.getByText("billet-aller.pdf · 50 Ko")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Télécharger" })).toHaveAttribute(
      "href",
      "/api/trips/trip-1/tickets/ticket-1",
    );
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
      .mockResolvedValueOnce({ status: 401 });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina Manager." }),
    ).toBeInTheDocument();
    window.dispatchEvent(new Event("focus"));

    expect(
      await screen.findByRole("heading", {
        name: "Votre espace vous attend.",
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
      .mockResolvedValueOnce({ status: 403 });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina Manager." }),
    ).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(
      await screen.findByRole("heading", {
        name: "Votre espace vous attend.",
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
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina Manager." }),
    ).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(staleJson).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("tab", { name: "Mon compte" }));
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(
      await screen.findByRole("heading", {
        name: "Votre espace vous attend.",
      }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveStaleProfile(profile);
      await staleProfileBody;
    });

    expect(
      screen.getByRole("heading", {
        name: "Votre espace vous attend.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Gestionnaire")).not.toBeInTheDocument();
  });
});
