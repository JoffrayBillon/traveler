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
import { buttonStyles, eyebrowStyles } from "./components/ui";
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
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const previousPath = useRef(location.pathname);
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

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    mainRef.current?.focus();
  }, [location.pathname]);

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

  const updateTripName = useCallback((tripId: string, tripName: string) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            trips: current.trips.map((trip) =>
              trip.tripId === tripId ? { ...trip, tripName } : trip,
            ),
          }
        : current,
    );
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_50%_-35%,rgb(219_224_209/44%),transparent_57%),var(--page)] text-[var(--ink)] transition-colors duration-200">
        <a
          className="absolute left-4 top-[-6rem] z-10 rounded-lg bg-[var(--forest-deep)] px-4 py-3 font-bold text-white focus:top-4"
          href="#main"
        >
          Aller au contenu
        </a>
        <header className="mx-auto flex min-h-[92px] w-[min(100%-3rem,1180px)] flex-wrap items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--line),transparent_24%)] max-[760px]:min-h-[74px] max-[480px]:w-[min(100%-2rem,1180px)]">
          <Link
            className="inline-flex items-center gap-3 text-[var(--ink)] no-underline"
            to={profile ? "/trips" : "/"}
            aria-label="Traveler, accueil"
          >
            <span
              className="grid size-[2.6rem] place-items-center rounded-2xl bg-[var(--forest-deep)] text-[#f4f3e9] max-[480px]:size-9"
              aria-hidden="true"
            >
              <MountainSnow size={22} />
            </span>
            <span className="text-2xl font-extrabold tracking-[-0.07em] max-[480px]:text-xl">
              traveler<span>.</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-5 max-[760px]:gap-2">
            {profile ? (
              <nav
                className="flex items-center gap-1"
                aria-label="Navigation principale"
              >
                <NavLink
                  className="rounded-full px-3 py-2 text-sm font-semibold text-[var(--muted)] no-underline hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] aria-[current=page]:bg-[var(--surface-soft)] aria-[current=page]:text-[var(--ink)] max-[760px]:px-2 max-[760px]:text-xs"
                  to="/trips"
                >
                  Mes voyages
                </NavLink>
                <NavLink
                  className="rounded-full px-3 py-2 text-sm font-semibold text-[var(--muted)] no-underline hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] aria-[current=page]:bg-[var(--surface-soft)] aria-[current=page]:text-[var(--ink)] max-[760px]:px-2 max-[760px]:text-xs"
                  to="/account"
                >
                  Mon compte
                </NavLink>
              </nav>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[var(--muted)] max-[760px]:hidden">
                <LockKeyhole aria-hidden="true" size={15} /> Accès privé
              </span>
            )}
            <ThemeToggle isDark={isDark} onChange={setIsDark} />
          </div>
        </header>

        <main
          ref={mainRef}
          className="flex flex-1 items-center"
          id="main"
          tabIndex={-1}
        >
          {profileStatus === "checking" ? (
            <section
              className="flex w-[min(100%-3rem,1180px)] flex-1 items-center justify-center gap-4 text-[var(--muted)]"
              aria-busy="true"
              role="status"
            >
              <span className="grid size-[3.6rem] animate-[mark-breathe_1.8s_ease-in-out_infinite] place-items-center rounded-2xl bg-[var(--surface-soft)] text-[var(--forest-bright)]">
                <MountainSnow aria-hidden="true" size={26} />
              </span>
              <p>Préparation de votre espace…</p>
            </section>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                className="min-h-px"
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
                          <OrganizerRoute
                            profile={profile}
                            onTripNameChange={updateTripName}
                          />
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

        <footer className="mx-auto flex min-h-[74px] w-[min(100%-3rem,1180px)] items-center justify-between gap-4 border-t border-[var(--line)] py-5 text-xs text-[var(--quiet)] max-[760px]:w-[min(100%-2rem,1180px)] max-[480px]:flex-col max-[480px]:items-start max-[480px]:justify-center max-[480px]:gap-1">
          <span>
            <strong className="text-sm font-extrabold tracking-[-0.04em] text-[var(--muted)]">
              Traveler<span className="text-[var(--sun)]">.</span>
            </strong>
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
    <section
      className="mx-auto my-12 mb-20 w-[min(100%-3rem,1120px)] max-[760px]:my-6 max-[760px]:mb-12 max-[760px]:w-[min(100%-2rem,1120px)]"
      aria-label={trip.tripName}
    >
      <div className="mb-8 flex w-full items-center justify-between gap-4 max-[480px]:items-start max-[480px]:flex-col">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] no-underline hover:text-[var(--forest-bright)]"
          to="/trips"
        >
          <ArrowLeft aria-hidden="true" size={17} /> Tous mes voyages
        </Link>
        {trip.role !== "traveler" && (
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] no-underline hover:text-[var(--forest-bright)]"
            to={`/trips/${encodeURIComponent(tripId)}/organize`}
          >
            Outils d’organisation <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        )}
      </div>
      <TripWorkspace
        key={`${profile.user.id}:${tripId}`}
        tripId={tripId}
        role={trip.role}
        userId={profile.user.id}
      />
    </section>
  );
}

function OrganizerRoute({
  profile,
  onTripNameChange,
}: {
  profile: TravelerProfile;
  onTripNameChange: (tripId: string, name: string) => void;
}) {
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
      onTripNameChange={(name) => onTripNameChange(tripId, name)}
    />
  );
}

function NotFound() {
  return (
    <section
      className="mx-auto my-12 mb-20 grid min-h-[45vh] w-[min(100%-3rem,1120px)] content-center justify-items-center text-center max-[760px]:my-6 max-[760px]:mb-12 max-[760px]:w-[min(100%-2rem,1120px)]"
      aria-labelledby="not-found-title"
    >
      <p className={eyebrowStyles()}>PAGE INTROUVABLE</p>
      <h1
        className="my-5 text-[clamp(2rem,4vw,3.4rem)] font-bold leading-tight tracking-[-0.06em] text-[var(--ink)]"
        id="not-found-title"
      >
        Ce chemin ne mène nulle part.
      </h1>
      <Link
        className={buttonStyles({
          appearance: "primary",
          class: "mt-4 no-underline",
        })}
        to="/trips"
      >
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
