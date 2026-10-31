import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantAccess } from "./ParticipantAccess";

afterEach(() => vi.unstubAllGlobals());

describe("ParticipantAccess", () => {
  it("shows first-login state and lets a manager send a fresh link", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          participants: [
            {
              userId: "traveler-1",
              firstName: "Alex",
              lastName: "Voyageur",
              email: "alex@example.com",
              role: "traveler",
              lastLoginAt: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 202 });
    vi.stubGlobal("fetch", fetchMock);
    render(<ParticipantAccess tripId="trip-1" />);

    expect(await screen.findByText("Pas encore connecté")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Envoyer un lien" }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/trips/trip-1/participants/traveler-1/login-link",
      { method: "POST" },
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Le lien de connexion a été envoyé à cette personne.",
    );
  });

  it("reports the server cooldown without retrying", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          participants: [
            {
              userId: "traveler-1",
              firstName: "Alex",
              lastName: "Voyageur",
              email: "alex@example.com",
              role: "traveler",
              lastLoginAt: "2026-10-30T12:00:00.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 429 });
    vi.stubGlobal("fetch", fetchMock);
    render(<ParticipantAccess tripId="trip-1" />);

    await user.click(
      await screen.findByRole("button", { name: "Renvoyer un lien" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Un lien vient d’être envoyé. Réessayez dans 30 secondes.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
