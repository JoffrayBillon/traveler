import {
  ArrowLeft,
  ArrowUpRight,
  LockKeyhole,
  MountainSnow,
} from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type FormEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { ThemeToggle } from "./components/ThemeToggle";
import type { TravelerProfile } from "./types/profile";
import "./styles.css";

const AccountPage = lazy(() =>
  import("./features/account/AccountPage").then((module) => ({
    default: module.AccountPage,
  })),
);
const OrganizerWorkspace = lazy(() =>
  import("./features/organizer/OrganizerWorkspace").then((module) => ({
    default: module.OrganizerWorkspace,
  })),
);
const SignInPage = lazy(() =>
  import("./features/auth/SignInPage").then((module) => ({
    default: module.SignInPage,
  })),
);
const TripsHome = lazy(() =>
  import("./features/trips/TripsHome").then((module) => ({
    default: module.TripsHome,
  })),
);
const TripWorkspace = lazy(() =>
  import("./features/trips/TripWorkspace").then((module) => ({
    default: module.TripWorkspace,
  })),
);

const SIGN_IN_COOLDOWN_SECONDS = 30;
const THEME_STORAGE_KEY = "traveler-theme";

export function App() {
  return (
    <BrowserRouter>
      <TravelerApp />
    </BrowserRouter>
  );
}

function TravelerApp() {
  const profileRequestId = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  const refreshProfile = useCallback(async () => {
    const currentRequest = ++profileRequestId.current;
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (currentRequest !== profileRequestId.current) return;
      if (response.status === 401 || response.status === 403) {
        setProfile(null);
        setProfileStatus("ready");
        return;
      }
      if (!response.ok)
        throw new Error("The traveler profile could not be loaded.");
      const nextProfile = (await response.json()) as TravelerProfile;
      if (currentRequest !== profileRequestId.current) return;
      setProfile(nextProfile);
      setProfileStatus("ready");
    } catch {
      if (currentRequest === profileRequestId.current)
        setProfileStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshProfile();
    }
    void refreshProfile();
    window.addEventListener("focus", refreshProfile);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      profileRequestId.current += 1;
      window.removeEventListener("focus", refreshProfile);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshProfile]);

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
      navigate("/", { replace: true });
    } catch {
      setProfileError("La déconnexion est momentanément indisponible.");
    }
  }

  const signInPage = (
    <SignInPage
      email={email}
      isSending={isSending || cooldownSeconds > 0}
      message={message}
      hasError={hasError}
      profileError={
        profileStatus === "unavailable"
          ? "Votre espace n’est pas joignable pour le moment. Réessayez dans un instant."
          : ""
      }
      cooldownSeconds={cooldownSeconds}
      onEmailChange={setEmail}
      onSubmit={requestSignIn}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Aller au contenu
        </a>
        <header className="site-header">
          <Link
            className="brand"
            to={profile ? "/trips" : "/"}
            aria-label="Traveler, accueil"
          >
            <span className="brand-mark" aria-hidden="true">
              <MountainSnow size={22} />
            </span>
            <span className="brand-word">
              traveler<span>.</span>
            </span>
          </Link>
          <div className="header-actions">
            {profile ? (
              <nav className="primary-nav" aria-label="Navigation principale">
                <NavLink to="/trips">Mes voyages</NavLink>
                <NavLink to="/account">Mon compte</NavLink>
              </nav>
            ) : (
              <span className="private-label">
                <LockKeyhole aria-hidden="true" size={15} /> Accès privé
              </span>
            )}
            <ThemeToggle isDark={isDark} onChange={setIsDark} />
          </div>
        </header>

        <main id="main" tabIndex={-1}>
          {profileStatus === "checking" ? (
            <section className="loading-panel" aria-busy="true" role="status">
              <span className="loading-mark">
                <MountainSnow aria-hidden="true" size={26} />
              </span>
              <p>Préparation de votre espace…</p>
            </section>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                className="route-stage"
                key={location.pathname}
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, y: 14, filter: "blur(5px)" }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                {...(reduceMotion
                  ? {}
                  : { exit: { opacity: 0, y: -10, filter: "blur(4px)" } })}
                transition={{
                  duration: reduceMotion ? 0 : 0.28,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Suspense
                  fallback={<p role="status">Chargement de votre espace…</p>}
                >
                  <Routes location={location}>
                    <Route
                      path="/"
                      element={
                        profile ? <Navigate to="/trips" replace /> : signInPage
                      }
                    />
                    <Route
                      path="/trips"
                      element={
                        profile ? (
                          <TripsHome profile={profile} />
                        ) : (
                          <Navigate to="/" replace />
                        )
                      }
                    />
                    <Route
                      path="/trips/:tripId"
                      element={
                        profile ? (
                          <TripRoute profile={profile} />
                        ) : (
                          <Navigate to="/" replace />
                        )
                      }
                    />
                    <Route
                      path="/trips/:tripId/organize"
                      element={
                        profile ? (
                          <OrganizerRoute profile={profile} />
                        ) : (
                          <Navigate to="/" replace />
                        )
                      }
                    />
                    <Route
                      path="/account"
                      element={
                        profile ? (
                          <AccountPage
                            profile={profile}
                            profileError={profileError}
                            onSignOut={signOut}
                          />
                        ) : (
                          <Navigate to="/" replace />
                        )
                      }
                    />
                    <Route
                      path="*"
                      element={
                        <Navigate to={profile ? "/trips" : "/"} replace />
                      }
                    />
                  </Routes>
                </Suspense>
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        <footer className="site-footer">
          <span>
            Traveler<span className="footer-dot">.</span>
          </span>
          <span>Les voyages se vivent mieux quand tout est clair.</span>
        </footer>
      </div>
    </MotionConfig>
  );
}

function TripRoute({ profile }: { profile: TravelerProfile }) {
  const { tripId = "" } = useParams();
  const trip = profile.trips.find((item) => item.tripId === tripId);
  if (!trip) return <NotFound />;
  return (
    <section className="trip-page" aria-label={trip.tripName}>
      <div className="trip-page-nav">
        <Link className="back-link" to="/trips">
          <ArrowLeft aria-hidden="true" size={17} /> Tous mes voyages
        </Link>
        {trip.role !== "traveler" && (
          <Link
            className="organizer-link"
            to={`/trips/${encodeURIComponent(tripId)}/organize`}
          >
            Outils d’organisation <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        )}
      </div>
      <TripWorkspace
        tripId={tripId}
        role={trip.role}
        userId={profile.user.id}
      />
    </section>
  );
}

function OrganizerRoute({ profile }: { profile: TravelerProfile }) {
  const { tripId = "" } = useParams();
  const trip = profile.trips.find((item) => item.tripId === tripId);
  if (!trip) return <NotFound />;
  if (trip.role === "traveler")
    return <Navigate to={`/trips/${encodeURIComponent(tripId)}`} replace />;
  return (
    <OrganizerWorkspace
      tripId={tripId}
      tripName={trip.tripName}
      role={trip.role}
    />
  );
}

function NotFound() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <p className="eyebrow">PAGE INTROUVABLE</p>
      <h1 id="not-found-title">Ce chemin ne mène nulle part.</h1>
      <Link className="primary-action" to="/trips">
        Revenir à mes voyages
      </Link>
    </section>
  );
}

function readInitialTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  } catch {
    return false;
  }
}
