import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Button,
  Form,
  Input,
  Label,
  Text,
  TextField,
  ToggleButton,
} from "react-aria-components";

const SIGN_IN_COOLDOWN_SECONDS = 30;

export function App() {
  const profileRequestId = useRef(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [isDark, setIsDark] = useState(false);
  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<
    "checking" | "ready" | "unavailable"
  >("checking");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (cooldownUntil === 0) return;
    function refreshCooldown() {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= cooldownUntil) setCooldownUntil(0);
    }
    const timer = window.setInterval(refreshCooldown, 1000);
    window.addEventListener("focus", refreshCooldown);
    document.addEventListener("visibilitychange", refreshCooldown);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshCooldown);
      document.removeEventListener("visibilitychange", refreshCooldown);
    };
  }, [cooldownUntil]);

  function startCooldown(seconds: number) {
    setNow(Date.now());
    setCooldownUntil(Date.now() + seconds * 1000);
  }

  useEffect(() => {
    let active = true;
    async function refreshProfile() {
      const currentRequest = ++profileRequestId.current;
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!active || currentRequest !== profileRequestId.current) return;
        if (response.status === 401) {
          setProfile(null);
          setProfileStatus("ready");
          return;
        }
        if (response.status === 403) {
          setProfile(null);
          setProfileStatus("ready");
          return;
        }
        if (!response.ok)
          throw new Error("The traveler profile could not be loaded.");
        const nextProfile = (await response.json()) as TravelerProfile;
        if (!active || currentRequest !== profileRequestId.current) return;
        setProfile(nextProfile);
        setProfileStatus("ready");
      } catch {
        if (active && currentRequest === profileRequestId.current)
          setProfileStatus("unavailable");
      }
    }
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshProfile();
    }
    function refreshOnFocus() {
      void refreshProfile();
    }
    void refreshProfile();
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  async function requestSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending || cooldownSeconds > 0) return;
    setIsSending(true);
    setMessage("");
    setHasError(false);
    try {
      const response = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, callbackURL: "/" }),
      });
      if (response.status === 429) {
        const retryAfter = Number.parseInt(
          response.headers.get("Retry-After") ?? "",
          10,
        );
        const seconds =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
        startCooldown(seconds);
        setHasError(true);
        setMessage(`Trop de demandes. Réessayez dans ${seconds} secondes.`);
        return;
      }
      if (!response.ok) throw new Error("The sign-in service is unavailable.");
      startCooldown(SIGN_IN_COOLDOWN_SECONDS);
      setMessage(
        "Si cette adresse est autorisée, un lien de connexion vient d’être envoyé.",
      );
    } catch {
      startCooldown(SIGN_IN_COOLDOWN_SECONDS);
      setHasError(true);
      setMessage(
        "La connexion est momentanément indisponible. Réessayez plus tard.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function signOut() {
    setProfileError("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed.");
      profileRequestId.current += 1;
      setProfile(null);
      setProfileStatus("ready");
    } catch {
      setProfileError("La déconnexion est momentanément indisponible.");
    }
  }

  return (
    <div className="app-shell" data-theme={isDark ? "dark" : "light"}>
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="site-header">
        <span className="brand">Traveler</span>
        <ToggleButton
          className="theme-toggle"
          isSelected={isDark}
          onChange={setIsDark}
        >
          Thème sombre
        </ToggleButton>
      </header>
      <main id="main" tabIndex={-1} className="welcome">
        {profileStatus === "checking" ? (
          <p role="status">Chargement de votre espace…</p>
        ) : profile ? (
          <>
            <p className="eyebrow">Les départs se préparent ensemble</p>
            <h1>Bonjour {profile.user.name}.</h1>
            <p className="intro">
              Vos voyages et votre rôle dans chacun d’eux.
            </p>
            <ul className="trip-list">
              {profile.trips.map((trip) => (
                <li key={trip.tripId}>
                  <strong>{trip.tripName}</strong>
                  <span>{roleLabel[trip.role]}</span>
                </li>
              ))}
            </ul>
            {profileError && (
              <p className="form-message" role="alert">
                {profileError}
              </p>
            )}
            <Button className="sign-in-button" onPress={signOut}>
              Se déconnecter
            </Button>
          </>
        ) : (
          <>
            <p className="eyebrow">Les départs se préparent ensemble</p>
            <h1>Retrouvez votre espace voyage.</h1>
            <p className="intro">
              Connectez-vous avec l’adresse e-mail communiquée à l’organisation.
            </p>
            {profileStatus === "unavailable" && (
              <p className="form-message" role="status">
                Votre espace n’est pas joignable pour le moment.
              </p>
            )}
            <Form className="sign-in-form" onSubmit={requestSignIn}>
              <TextField
                type="email"
                name="email"
                value={email}
                onChange={setEmail}
                isRequired
                autoComplete="email"
              >
                <Label>Adresse e-mail</Label>
                <Input className="email-input" />
              </TextField>
              <Button
                className="sign-in-button"
                type="submit"
                isDisabled={isSending || cooldownSeconds > 0}
              >
                {isSending
                  ? "Envoi en cours…"
                  : cooldownSeconds > 0
                    ? `Réessayez dans ${cooldownSeconds} s`
                    : "Recevoir un lien de connexion"}
              </Button>
              {message && (
                <Text
                  className="form-message"
                  role={hasError ? "alert" : "status"}
                  aria-live={hasError ? "assertive" : "polite"}
                >
                  {message}
                </Text>
              )}
            </Form>
          </>
        )}
      </main>
      <footer className="site-footer">Traveler · Voyages entre nous</footer>
    </div>
  );
}

type TravelerProfile = {
  user: { id: string; name: string; email: string };
  trips: {
    tripId: string;
    tripName: string;
    role: "traveler" | "companion" | "manager";
  }[];
};

const roleLabel = {
  traveler: "Voyageur",
  companion: "Accompagnateur",
  manager: "Gestionnaire",
} satisfies Record<TravelerProfile["trips"][number]["role"], string>;
