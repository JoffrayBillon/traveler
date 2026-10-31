import { act, fireEvent, render, screen } from "@testing-library/react";
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
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Retrouvez votre espace voyage",
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
    const { container } = render(<App />);
    await user.tab();
    await user.tab();
    const toggle = screen.getByRole("button", { name: "Thème sombre" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(container.firstElementChild).toHaveAttribute("data-theme", "dark");
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("has no detectable semantic accessibility violations", async () => {
    const { container } = render(<App />);
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
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
    await user.click(
      screen.getByRole("button", { name: "Recevoir un lien de connexion" }),
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "traveler@example.com", callbackURL: "/" }),
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
    await user.click(
      screen.getByRole("button", { name: "Recevoir un lien de connexion" }),
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
    await user.click(
      screen.getByRole("button", { name: "Recevoir un lien de connexion" }),
    );

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
        .getByRole("button", { name: "Recevoir un lien de connexion" })
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
      screen.getByRole("button", { name: "Recevoir un lien de connexion" }),
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
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-out", {
      method: "POST",
    });
    expect(
      await screen.findByRole("heading", {
        name: "Retrouvez votre espace voyage.",
      }),
    ).toBeInTheDocument();
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
        name: "Retrouvez votre espace voyage.",
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
        name: "Retrouvez votre espace voyage.",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not restore a stale profile response after signing out", async () => {
    const user = userEvent.setup();
    let resolveStaleProfile!: (value: {
      ok: boolean;
      status: number;
      json: () => Promise<{
        user: { id: string; name: string; email: string };
        trips: { tripId: string; tripName: string; role: "manager" }[];
      }>;
    }) => void;
    const staleProfileResponse = new Promise<{
      ok: boolean;
      status: number;
      json: () => Promise<{
        user: { id: string; name: string; email: string };
        trips: { tripId: string; tripName: string; role: "manager" }[];
      }>;
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => profile,
      })
      .mockReturnValueOnce(staleProfileResponse)
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bonjour Mina Manager." }),
    ).toBeInTheDocument();
    window.dispatchEvent(new Event("focus"));
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(
      await screen.findByRole("heading", {
        name: "Retrouvez votre espace voyage.",
      }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveStaleProfile({ ok: true, status: 200, json: async () => profile });
      await staleProfileResponse;
    });

    expect(
      screen.getByRole("heading", {
        name: "Retrouvez votre espace voyage.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Gestionnaire")).not.toBeInTheDocument();
  });
});
