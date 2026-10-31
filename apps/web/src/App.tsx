import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Button,
  Form,
  Input,
  Label,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextField,
  ToggleButton,
} from "react-aria-components";

const SIGN_IN_COOLDOWN_SECONDS = 30;
const THEME_STORAGE_KEY = "traveler-theme";

export function App() {
  const profileRequestId = useRef(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [isDark, setIsDark] = useState(readInitialTheme);
  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<
    "checking" | "ready" | "unavailable"
  >("checking");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [profileError, setProfileError] = useState("");
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark]);

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

  useEffect(() => {
    let active = true;
    async function refreshProfile() {
      const currentRequest = ++profileRequestId.current;
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!active || currentRequest !== profileRequestId.current) return;
        if (response.status === 401 || response.status === 403) {
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

  function startCooldown(seconds: number) {
    setNow(Date.now());
    setCooldownUntil(Date.now() + seconds * 1000);
  }

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
        body: JSON.stringify({
          email,
          callbackURL: `${window.location.origin}/`,
        }),
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
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Traveler, accueil">
          <span className="brand-mark" aria-hidden="true">
            <MountainIcon />
          </span>
          <span className="brand-word">
            traveler<span>.</span>
          </span>
        </a>
        <div className="header-actions">
          <span className="private-label">
            <LockIcon /> Accès privé
          </span>
          <ToggleButton
            aria-label={
              isDark ? "Activer le thème clair" : "Activer le thème sombre"
            }
            className="theme-toggle"
            isSelected={isDark}
            onChange={setIsDark}
          >
            <span className="theme-icon" aria-hidden="true">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </span>
            <span>{isDark ? "Clair" : "Sombre"}</span>
          </ToggleButton>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {profileStatus === "checking" ? (
          <section className="loading-panel" aria-busy="true" role="status">
            <span className="loading-mark">
              <MountainIcon />
            </span>
            <p>Préparation de votre espace…</p>
          </section>
        ) : profile ? (
          <MemberHome
            profile={profile}
            profileError={profileError}
            onSignOut={signOut}
          />
        ) : (
          <section className="welcome-layout" aria-labelledby="welcome-title">
            <div className="welcome-art">
              <div className="art-topline">
                <span className="art-symbol">
                  <MountainIcon />
                </span>
                <span>UN VOYAGE, BIEN PRÉPARÉ</span>
              </div>
              <div className="art-copy">
                <p className="eyebrow">L’aventure commence ici</p>
                <h1 id="welcome-title">
                  Tout le voyage.
                  <br />
                  Au même endroit.
                </h1>
                <p className="art-description">
                  Les informations partagées par votre équipe, réunies dans un
                  espace simple et personnel.
                </p>
              </div>
              <div className="mountain-scene" aria-hidden="true">
                <div className="sun-disc" />
                <div className="mountain mountain-back" />
                <div className="mountain mountain-mid" />
                <div className="mountain mountain-front" />
                <div className="scene-snow scene-snow-one" />
                <div className="scene-snow scene-snow-two" />
              </div>
              <div className="art-caption">
                <span className="caption-dot" /> Un espace réservé aux voyageurs
                invités
              </div>
            </div>

            <div className="sign-in-side">
              <div className="sign-in-card">
                <div className="card-emblem">
                  <ArrowIcon />
                </div>
                <p className="eyebrow">Ravi de vous retrouver</p>
                <h2>Votre espace vous attend.</h2>
                <p className="card-intro">
                  Entrez l’adresse e-mail communiquée à l’organisation. Nous
                  vous enverrons un lien sécurisé.
                </p>
                {profileStatus === "unavailable" && (
                  <p className="form-message error-message" role="status">
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
                    <Input
                      className="email-input"
                      placeholder="vous@exemple.fr"
                    />
                  </TextField>
                  <Button
                    className="sign-in-button"
                    type="submit"
                    isDisabled={isSending || cooldownSeconds > 0}
                  >
                    <span>
                      {isSending
                        ? "Envoi en cours…"
                        : cooldownSeconds > 0
                          ? `Réessayez dans ${cooldownSeconds} s`
                          : "Recevoir mon lien"}
                    </span>
                    {!isSending && cooldownSeconds === 0 && <ArrowIcon />}
                  </Button>
                  {message && (
                    <Text
                      className={`form-message${hasError ? " error-message" : " success-message"}`}
                      role={hasError ? "alert" : "status"}
                      aria-live={hasError ? "assertive" : "polite"}
                    >
                      {message}
                    </Text>
                  )}
                </Form>
                <div className="security-note">
                  <LockIcon />
                  <span>Connexion privée, sans mot de passe.</span>
                </div>
              </div>
              <p className="help-note">
                Vous n’avez pas reçu de lien ? Vérifiez vos courriers
                indésirables ou contactez l’organisation.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <span>
          Traveler<span className="footer-dot">.</span>
        </span>
        <span>Les voyages se vivent mieux quand tout est clair.</span>
      </footer>
    </div>
  );
}

function MemberHome({
  profile,
  profileError,
  onSignOut,
}: {
  profile: TravelerProfile;
  profileError: string;
  onSignOut: () => void;
}) {
  return (
    <section className="member-layout" aria-labelledby="member-title">
      <div className="member-heading">
        <div>
          <p className="eyebrow">Votre espace voyage</p>
          <h1 id="member-title">Bonjour {profile.user.name}.</h1>
          <p className="member-subtitle">
            Retrouvez les voyages auxquels vous participez.
          </p>
        </div>
        <div className="member-avatar" aria-hidden="true">
          {initials(profile.user.name)}
        </div>
      </div>

      <Tabs className="member-tabs" defaultSelectedKey="trips">
        <TabList aria-label="Votre espace personnel">
          <Tab id="trips">
            <TripIcon /> Mes voyages
          </Tab>
          <Tab id="account">
            <PersonIcon /> Mon compte
          </Tab>
        </TabList>
        <TabPanel id="trips" className="tab-panel">
          <div className="section-heading">
            <div>
              <h2>Vos voyages</h2>
              <p>Votre rôle et votre accès pour chaque séjour.</p>
            </div>
            <span className="count-pill">
              {profile.trips.length} séjour{profile.trips.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="trip-grid">
            {profile.trips.map((trip) => (
              <li className="trip-card" key={trip.tripId}>
                <div className="trip-card-top">
                  <span className="trip-icon">
                    <TripIcon />
                  </span>
                  <span className="trip-status">
                    <span /> Accès actif
                  </span>
                </div>
                <h3>{trip.tripName}</h3>
                <div className="trip-card-footer">
                  <span className="role-chip">{roleLabel[trip.role]}</span>
                  <span className="trip-card-note">Espace personnel</span>
                </div>
              </li>
            ))}
          </ul>
        </TabPanel>
        <TabPanel id="account" className="tab-panel">
          <div className="section-heading">
            <div>
              <h2>Votre compte</h2>
              <p>Les informations liées à votre connexion.</p>
            </div>
          </div>
          <div className="account-card">
            <div className="account-avatar">
              <PersonIcon />
            </div>
            <div className="account-details">
              <span className="detail-label">Nom</span>
              <strong>{profile.user.name}</strong>
              <span className="detail-label">Adresse e-mail</span>
              <strong>{profile.user.email}</strong>
            </div>
            <Button className="sign-out-button" onPress={onSignOut}>
              <SignOutIcon /> Se déconnecter
            </Button>
          </div>
          {profileError && (
            <p className="form-message error-message" role="alert">
              {profileError}
            </p>
          )}
        </TabPanel>
      </Tabs>
      <div className="member-footnote">
        <LockIcon /> Seuls les voyages qui vous sont attribués apparaissent ici.
      </div>
    </section>
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

function readInitialTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark") return true;
  if (savedTheme === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("fr-FR") ?? "")
    .join("");
}

function MountainIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="m3 25 8.1-13.2 4.2 6.1 4.2-7.5L29 25H3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m18.1 16.7 1.4-2.4 2.1 3.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="8"
        width="13"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M6.5 8V5.8a3.5 3.5 0 0 1 7 0V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M16.4 12.5A7 7 0 0 1 7.5 3.6a7 7 0 1 0 8.9 8.9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3.3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 1.8v2m0 12.4v2m8.2-8.2h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TripIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 14.5 7.3 6l2.6 4.2L12.5 5l4.5 9.5H3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m11 8 1.5 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="6.4" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 17c.4-3 2.4-4.6 6-4.6s5.6 1.6 6 4.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M8 3H4.8A1.8 1.8 0 0 0 3 4.8v10.4A1.8 1.8 0 0 0 4.8 17H8m3-10 3 3-3 3m3-3H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
