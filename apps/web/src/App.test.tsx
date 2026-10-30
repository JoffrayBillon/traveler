import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401 }));
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
});
