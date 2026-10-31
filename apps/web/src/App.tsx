import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Button,
  Checkbox,
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
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
  const [selectedTripId, setSelectedTripId] = useState(
    profile.trips[0]?.tripId ?? "",
  );
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
          <Tab id="trip-workspace-tab">Mon voyage</Tab>
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
                <ToggleButton
                  className="trip-card-button"
                  isSelected={selectedTripId === trip.tripId}
                  onChange={() => setSelectedTripId(trip.tripId)}
                  aria-label={`Sélectionner ${trip.tripName}`}
                >
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
                </ToggleButton>
              </li>
            ))}
          </ul>
          {selectedTripId && (
            <Button
              className="primary-action"
              onPress={() => {
                document.getElementById("trip-workspace-tab")?.click();
              }}
            >
              Ouvrir mon voyage <ArrowIcon />
            </Button>
          )}
        </TabPanel>
        <TabPanel id="trip-workspace-tab" className="tab-panel">
          {selectedTripId ? (
            <TripWorkspace
              tripId={selectedTripId}
              role={
                profile.trips.find((trip) => trip.tripId === selectedTripId)
                  ?.role ?? "traveler"
              }
              userId={profile.user.id}
            />
          ) : (
            <p>Aucun voyage n’est disponible pour votre compte.</p>
          )}
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

type TravelerTripData = {
  trip: { id: string; name: string };
  traveler: {
    firstName: string;
    lastName: string;
    gender: "M" | "F" | null;
    role: "traveler" | "companion" | "manager";
  };
  details: null | {
    activityProfile: "ski" | "spa" | null;
    skiDayThree: boolean;
    transportMode: "train" | "flight" | "none" | null;
    departureCity: string | null;
    outboundDateTime: string | null;
    outboundTimezone: string | null;
    outboundMeetingTime: string | null;
    outboundDepartureTime: string | null;
    outboundLocation: string | null;
    outboundReference: string | null;
    outboundSeat: string | null;
    returnDateTime: string | null;
    returnTimezone: string | null;
    returnMeetingTime: string | null;
    returnDepartureTime: string | null;
    returnLocation: string | null;
    returnReference: string | null;
    returnSeat: string | null;
    carpoolPreference: boolean | null;
    parkingPreference: boolean | null;
    updatedAt: string | null;
  };
  tickets: {
    id: string;
    kind: "outbound" | "return" | "other";
    originalName: string;
    size: number;
    createdAt: string;
  }[];
};

function TripWorkspace({
  tripId,
  role,
  userId,
}: {
  tripId: string;
  role: "traveler" | "companion" | "manager";
  userId: string;
}) {
  const [data, setData] = useState<TravelerTripData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setData(null);
    fetch(`/api/trips/${encodeURIComponent(tripId)}/traveler`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Trip information unavailable");
        return (await response.json()) as TravelerTripData;
      })
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  if (status === "loading")
    return <p role="status">Chargement des informations du voyage…</p>;
  if (status === "unavailable" || !data)
    return (
      <p role="alert">
        Les informations du voyage ne sont pas accessibles pour le moment.
      </p>
    );

  const details = data.details;
  return (
    <div className="trip-workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{data.trip.name}</p>
          <h2>Votre séjour</h2>
          <p>Les informations partagées par l’équipe d’organisation.</p>
        </div>
        <span className="role-chip">{roleLabel[role]}</span>
      </div>
      <div className="details-grid">
        <article className="detail-card">
          <span className="detail-label">Activité</span>
          <strong>
            {details?.activityProfile === "ski"
              ? "Ski"
              : details?.activityProfile === "spa"
                ? "Spa"
                : "À confirmer"}
          </strong>
          <p>
            {details?.skiDayThree
              ? "Forfait ski 3 jours"
              : details?.activityProfile === "ski"
                ? "Forfait ski 2 jours"
                : ""}
          </p>
        </article>
        <article className="detail-card">
          <span className="detail-label">Transport</span>
          <strong>
            {transportLabel[details?.transportMode ?? ""] ?? "À confirmer"}
          </strong>
          <p>
            {details?.departureCity ??
              details?.outboundLocation ??
              "Les informations seront ajoutées par l’équipe."}
          </p>
        </article>
        <article className="detail-card">
          <span className="detail-label">Aller</span>
          <strong>
            {formatDate(
              details?.outboundDateTime ?? details?.outboundDepartureTime,
            )}
          </strong>
          <p>
            {[
              details?.outboundMeetingTime &&
                `Rendez-vous ${details.outboundMeetingTime}`,
              details?.outboundLocation,
              details?.outboundReference && `Réf. ${details.outboundReference}`,
              details?.outboundSeat && `Place ${details.outboundSeat}`,
            ]
              .filter(Boolean)
              .join(" · ") || "Informations à venir"}
          </p>
        </article>
        <article className="detail-card">
          <span className="detail-label">Retour</span>
          <strong>
            {formatDate(
              details?.returnDateTime ?? details?.returnDepartureTime,
            )}
          </strong>
          <p>
            {[
              details?.returnMeetingTime &&
                `Rendez-vous ${details.returnMeetingTime}`,
              details?.returnLocation,
              details?.returnReference && `Réf. ${details.returnReference}`,
              details?.returnSeat && `Place ${details.returnSeat}`,
            ]
              .filter(Boolean)
              .join(" · ") || "Informations à venir"}
          </p>
        </article>
      </div>
      <section className="ticket-section" aria-labelledby="tickets-title">
        <div className="section-heading">
          <div>
            <h3 id="tickets-title">Titres de transport</h3>
            <p>Vos documents sont disponibles uniquement après connexion.</p>
          </div>
        </div>
        {data.tickets.length === 0 ? (
          <p className="empty-state">Aucun billet n’a encore été ajouté.</p>
        ) : (
          <ul className="ticket-list">
            {data.tickets.map((ticket) => (
              <li key={ticket.id}>
                <span>
                  <strong>{ticketLabel[ticket.kind]}</strong>
                  <small>
                    {ticket.originalName} · {formatBytes(ticket.size)}
                  </small>
                </span>
                <a
                  className="ticket-download"
                  href={`/api/trips/${encodeURIComponent(tripId)}/tickets/${encodeURIComponent(ticket.id)}`}
                >
                  Télécharger
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <RoomingPanel tripId={tripId} userId={userId} role={role} />
      {details?.transportMode === "none" && (
        <CarpoolPreferences
          tripId={tripId}
          carpoolPreference={details.carpoolPreference}
          parkingPreference={details.parkingPreference}
          onSaved={(carpoolPreference, parkingPreference) =>
            setData((current) =>
              current?.details
                ? {
                    ...current,
                    details: {
                      ...current.details,
                      carpoolPreference,
                      parkingPreference,
                    },
                  }
                : current,
            )
          }
        />
      )}
      {role !== "traveler" && (
        <StaffTools
          tripId={tripId}
          tripName={data.trip.name}
          isManager={role === "manager"}
          onTripNameChange={(name) =>
            setData((current) =>
              current
                ? { ...current, trip: { ...current.trip, name } }
                : current,
            )
          }
        />
      )}
    </div>
  );
}

function CarpoolPreferences({
  tripId,
  carpoolPreference,
  parkingPreference,
  onSaved,
}: {
  tripId: string;
  carpoolPreference: boolean | null;
  parkingPreference: boolean | null;
  onSaved: (carpoolPreference: boolean, parkingPreference: boolean) => void;
}) {
  const [carpool, setCarpool] = useState(carpoolPreference ?? false);
  const [parking, setParking] = useState(parkingPreference ?? false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCarpool(carpoolPreference ?? false);
    setParking(parkingPreference ?? false);
  }, [carpoolPreference, parkingPreference]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/carpool-preferences`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carpoolPreference: carpool,
          parkingPreference: carpool && parking,
        }),
      },
    );
    if (!response.ok) {
      setMessage("Vos préférences n’ont pas pu être enregistrées.");
      return;
    }
    onSaved(carpool, carpool && parking);
    setMessage("Vos préférences ont été enregistrées.");
  }

  return (
    <section className="carpool-card" aria-labelledby="carpool-title">
      <h3 id="carpool-title">Sans transport réservé</h3>
      <p>
        Indiquez si vous cherchez un covoiturage et, si oui, une place de
        parking.
      </p>
      <Form onSubmit={save}>
        <Checkbox
          isSelected={carpool}
          onChange={(selected) => {
            setCarpool(selected);
            if (!selected) setParking(false);
          }}
        >
          <span>Je viens en covoiturage</span>
        </Checkbox>
        {carpool && (
          <Checkbox isSelected={parking} onChange={setParking}>
            <span>Je demande une place de parking</span>
          </Checkbox>
        )}
        <Button className="secondary-action" type="submit">
          Enregistrer mes préférences
        </Button>
      </Form>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

type StaffTraveler = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "traveler" | "companion" | "manager";
} & TravelerDetailsDraft;

type TravelerDetailsDraft = {
  activityProfile: "ski" | "spa" | null;
  skiDayThree: boolean;
  transportMode: "train" | "flight" | "none" | null;
  departureCity: string | null;
  outboundDateTime: string | null;
  outboundTimezone: string | null;
  outboundMeetingTime: string | null;
  outboundDepartureTime: string | null;
  outboundLocation: string | null;
  outboundReference: string | null;
  outboundSeat: string | null;
  returnDateTime: string | null;
  returnTimezone: string | null;
  returnMeetingTime: string | null;
  returnDepartureTime: string | null;
  returnLocation: string | null;
  returnReference: string | null;
  returnSeat: string | null;
  carpoolPreference: boolean | null;
  parkingPreference: boolean | null;
};

function StaffTools({
  tripId,
  tripName,
  isManager,
  onTripNameChange,
}: {
  tripId: string;
  tripName: string;
  isManager: boolean;
  onTripNameChange: (name: string) => void;
}) {
  const [travelers, setTravelers] = useState<StaffTraveler[]>([]);
  const [travelerId, setTravelerId] = useState<string | null>(null);
  const [detailsTravelerId, setDetailsTravelerId] = useState<string | null>(
    null,
  );
  const [detailsDraft, setDetailsDraft] = useState<TravelerDetailsDraft | null>(
    null,
  );
  const [ticketKind, setTicketKind] = useState<string | null>(null);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editableTripName, setEditableTripName] = useState(tripName);
  const [companionFirstName, setCompanionFirstName] = useState("");
  const [companionLastName, setCompanionLastName] = useState("");
  const [companionEmail, setCompanionEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setEditableTripName(tripName);
  }, [tripName]);

  const refreshTravelers = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/travelers`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { travelers: StaffTraveler[] };
      setTravelers(data.travelers);
    } catch {
      setMessage(
        "La liste des voyageurs ne peut pas être chargée pour le moment.",
      );
    }
  }, [tripId]);

  useEffect(() => {
    void refreshTravelers();
  }, [refreshTravelers]);

  async function uploadTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!travelerId || !ticketKind || !ticketFile) return;
    if (ticketFile.size > 4 * 1024 * 1024) {
      setMessage("Le fichier dépasse la limite de 4 Mo.");
      return;
    }
    const form = new FormData();
    form.set("file", ticketFile);
    form.set("kind", ticketKind);
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId)}/tickets`,
      { method: "POST", body: form },
    );
    if (!response.ok) {
      setMessage(
        response.status === 503
          ? "Le stockage de billets n’est pas configuré sur cet environnement."
          : "Le billet n’a pas pu être téléversé. Vérifiez le type et la taille du fichier.",
      );
      return;
    }
    setTicketFile(null);
    setMessage("Le titre de transport a été ajouté.");
  }

  async function importParticipants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) return;
    if (importFile.size > 4 * 1024 * 1024) {
      setMessage("Le classeur Excel ne doit pas dépasser 4 Mo.");
      return;
    }
    const form = new FormData();
    form.set("file", importFile);
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/participants/import`,
      { method: "POST", body: form },
    );
    const result = (await response.json().catch(() => ({}))) as {
      created?: number;
      updated?: number;
      errors?: { row: number; field: string; message: string }[];
    };
    if (!response.ok) {
      setMessage(
        result.errors
          ?.map(
            (error) => `Ligne ${error.row} · ${error.field} : ${error.message}`,
          )
          .join("\n") ?? "L’import du fichier a échoué.",
      );
      return;
    }
    setMessage(
      `${result.created ?? 0} participant(s) ajouté(s), ${result.updated ?? 0} mis à jour. Les billets et affectations déjà gérés sont conservés.`,
    );
    setImportFile(null);
    await refreshTravelers();
  }

  async function saveTripName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editableTripName }),
    });
    if (!response.ok) {
      setMessage("Le nom du voyage n’a pas pu être mis à jour.");
      return;
    }
    onTripNameChange(editableTripName.trim());
    setMessage("Le nom du voyage a été mis à jour.");
  }

  async function appointCompanion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/companions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: companionFirstName,
          lastName: companionLastName,
          email: companionEmail,
        }),
      },
    );
    if (!response.ok) {
      setMessage("L’accompagnateur n’a pas pu être ajouté.");
      return;
    }
    setCompanionFirstName("");
    setCompanionLastName("");
    setCompanionEmail("");
    setMessage(
      "L’accompagnateur peut maintenant demander son lien de connexion.",
    );
    await refreshTravelers();
  }

  function changeDetails<Key extends keyof TravelerDetailsDraft>(
    key: Key,
    value: TravelerDetailsDraft[Key],
  ) {
    setDetailsDraft((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  async function saveTravelerDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailsTravelerId || !detailsDraft) return;
    const savedDetails =
      detailsDraft.transportMode === "none"
        ? {
            ...detailsDraft,
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
          }
        : {
            ...detailsDraft,
            carpoolPreference: null,
            parkingPreference: null,
          };
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(detailsTravelerId)}/details`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedDetails),
      },
    );
    if (!response.ok) {
      setMessage(
        "Les informations de voyage n’ont pas pu être enregistrées. Vérifiez que le ski J3 est réservé aux skieurs.",
      );
      return;
    }
    setMessage("Les informations de voyage ont été mises à jour.");
    await refreshTravelers();
  }

  function selectDetailsTraveler(key: string | number | null) {
    const nextId = key ? String(key) : null;
    const traveler = travelers.find((person) => person.userId === nextId);
    setDetailsTravelerId(nextId);
    setDetailsDraft(
      traveler
        ? {
            activityProfile: traveler.activityProfile,
            skiDayThree: traveler.skiDayThree,
            transportMode: traveler.transportMode,
            departureCity: traveler.departureCity,
            outboundDateTime: traveler.outboundDateTime,
            outboundTimezone: traveler.outboundTimezone,
            outboundMeetingTime: traveler.outboundMeetingTime,
            outboundDepartureTime: traveler.outboundDepartureTime,
            outboundLocation: traveler.outboundLocation,
            outboundReference: traveler.outboundReference,
            outboundSeat: traveler.outboundSeat,
            returnDateTime: traveler.returnDateTime,
            returnTimezone: traveler.returnTimezone,
            returnMeetingTime: traveler.returnMeetingTime,
            returnDepartureTime: traveler.returnDepartureTime,
            returnLocation: traveler.returnLocation,
            returnReference: traveler.returnReference,
            returnSeat: traveler.returnSeat,
            carpoolPreference: traveler.carpoolPreference,
            parkingPreference: traveler.parkingPreference,
          }
        : null,
    );
  }

  return (
    <section className="staff-tools" aria-labelledby="staff-tools-title">
      <div className="section-heading">
        <div>
          <h3 id="staff-tools-title">Outils d’organisation</h3>
          <p>Transport, rooming et données des participants.</p>
        </div>
      </div>
      <Form className="staff-tool-card" onSubmit={uploadTicket}>
        <h4>Ajouter un titre de transport</h4>
        <Select
          selectedKey={travelerId}
          onSelectionChange={(key) => setTravelerId(key ? String(key) : null)}
          isRequired
        >
          <Label>Voyageur</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              {travelers.map((person) => (
                <ListBoxItem
                  className="room-select-option"
                  key={person.userId}
                  id={person.userId}
                  textValue={`${person.firstName} ${person.lastName}`}
                >
                  {person.firstName} {person.lastName} · {person.email}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
        <Select
          selectedKey={ticketKind}
          onSelectionChange={(key) => setTicketKind(key ? String(key) : null)}
          isRequired
        >
          <Label>Trajet</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              <ListBoxItem className="room-select-option" id="outbound">
                Aller
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="return">
                Retour
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="other">
                Autre document
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <label className="file-picker">
          Fichier PDF, PNG ou JPEG (4 Mo max)
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => setTicketFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button className="secondary-action" type="submit">
          Téléverser le billet
        </Button>
      </Form>
      <Form className="staff-tool-card" onSubmit={saveTravelerDetails}>
        <h4>Informations de voyageur et de transport</h4>
        <Select
          selectedKey={detailsTravelerId}
          onSelectionChange={selectDetailsTraveler}
          isRequired
        >
          <Label>Voyageur à mettre à jour</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              {travelers.map((person) => (
                <ListBoxItem
                  className="room-select-option"
                  key={person.userId}
                  id={person.userId}
                  textValue={`${person.firstName} ${person.lastName}`}
                >
                  {person.firstName} {person.lastName} · {person.email}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
        <Select
          selectedKey={detailsDraft?.activityProfile ?? null}
          onSelectionChange={(key) => {
            if (key === "spa") changeDetails("skiDayThree", false);
            changeDetails(
              "activityProfile",
              key === "ski" || key === "spa" ? key : null,
            );
          }}
          isDisabled={!detailsDraft}
        >
          <Label>Formule</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              <ListBoxItem className="room-select-option" id="ski">
                Ski
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="spa">
                Spa
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        {detailsDraft?.activityProfile === "ski" && (
          <Checkbox
            isSelected={detailsDraft.skiDayThree}
            onChange={(checked) => changeDetails("skiDayThree", checked)}
          >
            Ski le troisième jour
          </Checkbox>
        )}
        <Select
          selectedKey={detailsDraft?.transportMode ?? null}
          onSelectionChange={(key) =>
            changeDetails(
              "transportMode",
              key === "train" || key === "flight" || key === "none"
                ? key
                : null,
            )
          }
          isDisabled={!detailsDraft}
        >
          <Label>Transport réservé</Label>
          <Button className="select-trigger">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox className="room-select-listbox">
              <ListBoxItem className="room-select-option" id="train">
                Train
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="flight">
                Avion
              </ListBoxItem>
              <ListBoxItem className="room-select-option" id="none">
                Aucun
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        {detailsDraft && detailsDraft.transportMode !== "none" && (
          <>
            <TextField
              value={detailsDraft.departureCity ?? ""}
              onChange={(value) =>
                changeDetails("departureCity", value || null)
              }
              isDisabled={!detailsDraft}
            >
              <Label>Ville de départ</Label>
              <Input />
            </TextField>
            <div className="staff-leg-fields">
              <h5>Aller</h5>
              <TextField
                value={detailsDraft.outboundDateTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundDateTime", value || null)
                }
              >
                <Label>Date et heure</Label>
                <Input type="datetime-local" />
              </TextField>
              <TextField
                value={detailsDraft.outboundTimezone ?? ""}
                onChange={(value) =>
                  changeDetails("outboundTimezone", value || null)
                }
              >
                <Label>Fuseau horaire</Label>
                <Input placeholder="Europe/Paris" />
              </TextField>
              <TextField
                value={detailsDraft.outboundMeetingTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundMeetingTime", value || null)
                }
              >
                <Label>Heure de rendez-vous</Label>
                <Input type="time" />
              </TextField>
              <TextField
                value={detailsDraft.outboundDepartureTime ?? ""}
                onChange={(value) =>
                  changeDetails("outboundDepartureTime", value || null)
                }
              >
                <Label>Heure de départ</Label>
                <Input type="time" />
              </TextField>
              <TextField
                value={detailsDraft.outboundLocation ?? ""}
                onChange={(value) =>
                  changeDetails("outboundLocation", value || null)
                }
              >
                <Label>Lieu / gare</Label>
                <Input />
              </TextField>
              <TextField
                value={detailsDraft.outboundReference ?? ""}
                onChange={(value) =>
                  changeDetails("outboundReference", value || null)
                }
              >
                <Label>Référence</Label>
                <Input />
              </TextField>
              <TextField
                value={detailsDraft.outboundSeat ?? ""}
                onChange={(value) =>
                  changeDetails("outboundSeat", value || null)
                }
              >
                <Label>Place</Label>
                <Input />
              </TextField>
            </div>
            <div className="staff-leg-fields">
              <h5>Retour</h5>
              <TextField
                value={detailsDraft.returnDateTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnDateTime", value || null)
                }
              >
                <Label>Date et heure</Label>
                <Input type="datetime-local" />
              </TextField>
              <TextField
                value={detailsDraft.returnTimezone ?? ""}
                onChange={(value) =>
                  changeDetails("returnTimezone", value || null)
                }
              >
                <Label>Fuseau horaire</Label>
                <Input placeholder="Europe/Paris" />
              </TextField>
              <TextField
                value={detailsDraft.returnMeetingTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnMeetingTime", value || null)
                }
              >
                <Label>Heure de rendez-vous</Label>
                <Input type="time" />
              </TextField>
              <TextField
                value={detailsDraft.returnDepartureTime ?? ""}
                onChange={(value) =>
                  changeDetails("returnDepartureTime", value || null)
                }
              >
                <Label>Heure de départ</Label>
                <Input type="time" />
              </TextField>
              <TextField
                value={detailsDraft.returnLocation ?? ""}
                onChange={(value) =>
                  changeDetails("returnLocation", value || null)
                }
              >
                <Label>Lieu / gare</Label>
                <Input />
              </TextField>
              <TextField
                value={detailsDraft.returnReference ?? ""}
                onChange={(value) =>
                  changeDetails("returnReference", value || null)
                }
              >
                <Label>Référence</Label>
                <Input />
              </TextField>
              <TextField
                value={detailsDraft.returnSeat ?? ""}
                onChange={(value) => changeDetails("returnSeat", value || null)}
              >
                <Label>Place</Label>
                <Input />
              </TextField>
            </div>
          </>
        )}
        <Button
          className="secondary-action"
          type="submit"
          isDisabled={!detailsTravelerId || !detailsDraft}
        >
          Enregistrer les informations
        </Button>
      </Form>
      {isManager && (
        <>
          <Form className="staff-tool-card" onSubmit={saveTripName}>
            <h4>Informations du voyage</h4>
            <TextField
              value={editableTripName}
              onChange={setEditableTripName}
              isRequired
            >
              <Label>Nom du voyage</Label>
              <Input maxLength={120} />
            </TextField>
            <Button className="secondary-action" type="submit">
              Enregistrer
            </Button>
          </Form>
          <Form className="staff-tool-card" onSubmit={appointCompanion}>
            <h4>Nommer un accompagnateur</h4>
            <TextField
              value={companionFirstName}
              onChange={setCompanionFirstName}
              isRequired
            >
              <Label>Prénom</Label>
              <Input autoComplete="given-name" />
            </TextField>
            <TextField
              value={companionLastName}
              onChange={setCompanionLastName}
              isRequired
            >
              <Label>Nom</Label>
              <Input autoComplete="family-name" />
            </TextField>
            <TextField
              type="email"
              value={companionEmail}
              onChange={setCompanionEmail}
              isRequired
            >
              <Label>Adresse e-mail</Label>
              <Input autoComplete="email" />
            </TextField>
            <Button className="secondary-action" type="submit">
              Ajouter l’accompagnateur
            </Button>
          </Form>
          <Form className="staff-tool-card" onSubmit={importParticipants}>
            <h4>Importer les participants</h4>
            <p>
              Import `.xlsx` jusqu’à 500 lignes. Une erreur bloque toute
              l’importation; une réimportation conserve les billets et chambres
              déjà gérés.
            </p>
            <a
              className="ticket-download"
              href={`/api/trips/${encodeURIComponent(tripId)}/participants/template`}
            >
              Télécharger le modèle Excel
            </a>
            <label className="file-picker">
              Classeur participants .xlsx
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) =>
                  setImportFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <Button className="secondary-action" type="submit">
              Valider et importer
            </Button>
          </Form>
          <a
            className="ticket-download"
            href={`/api/trips/${encodeURIComponent(tripId)}/rooms/export`}
          >
            Exporter le rooming Excel
          </a>
        </>
      )}
      {message && (
        <p className="form-message" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}

type RoomSummary = {
  id: string;
  name: string;
  capacity: number;
  occupiedCount: number;
  genderPolicy: "single_gender" | "mixed" | "unset";
  occupants: {
    userId: string;
    firstName: string;
    lastName: string;
    gender: "M" | "F" | null;
  }[];
};

type RoomRequestSummary = {
  id: string;
  requester?: { firstName: string; lastName: string };
  requiredConsents: {
    userId: string;
    firstName?: string;
    lastName?: string;
    approved: boolean;
  }[];
  moves: {
    userId: string;
    person?: { firstName: string; lastName: string };
    currentRoom?: string | null;
    targetRoom?: string;
  }[];
};

function RoomingPanel({
  tripId,
  userId,
  role,
}: {
  tripId: string;
  userId: string;
  role: "traveler" | "companion" | "manager";
}) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [requests, setRequests] = useState<RoomRequestSummary[]>([]);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);
  const [exchangeEmail, setExchangeEmail] = useState("");
  const [initialTravelerId, setInitialTravelerId] = useState<string | null>(
    null,
  );
  const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("4");
  const [unassignedTravelers, setUnassignedTravelers] = useState<
    StaffTraveler[]
  >([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const ownRoom = rooms.find((room) =>
    room.occupants.some((person) => person.userId === userId),
  );
  const availableRooms = rooms.filter(
    (room) => room.id !== ownRoom?.id && room.occupiedCount < room.capacity,
  );
  const targetRooms = rooms.filter(
    (room) =>
      room.id !== ownRoom?.id &&
      (room.occupiedCount < room.capacity || Boolean(ownRoom)),
  );
  const isStaff = role !== "traveler";

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const [roomResponse, requestResponse, travelerResponse] =
        await Promise.all([
          fetch(`/api/trips/${encodeURIComponent(tripId)}/rooms`, {
            cache: "no-store",
          }),
          fetch(`/api/trips/${encodeURIComponent(tripId)}/room-requests`, {
            cache: "no-store",
          }),
          isStaff
            ? fetch(`/api/trips/${encodeURIComponent(tripId)}/travelers`, {
                cache: "no-store",
              })
            : Promise.resolve(null),
        ]);
      if (
        !roomResponse.ok ||
        !requestResponse.ok ||
        (travelerResponse && !travelerResponse.ok)
      )
        throw new Error();
      const roomData = (await roomResponse.json()) as { rooms: RoomSummary[] };
      setRooms(roomData.rooms);
      setRequests(
        ((await requestResponse.json()) as { requests: RoomRequestSummary[] })
          .requests,
      );
      if (travelerResponse) {
        const data = (await travelerResponse.json()) as {
          travelers: StaffTraveler[];
        };
        const assigned = new Set(
          roomData.rooms.flatMap((room) =>
            room.occupants.map((occupant) => occupant.userId),
          ),
        );
        setUnassignedTravelers(
          data.travelers.filter((person) => !assigned.has(person.userId)),
        );
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [tripId, isStaff]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setMessage(roomErrorLabel[result.error ?? ""] ?? "L’opération a échoué.");
      return false;
    }
    return true;
  }

  async function requestChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetRoomId) return;
    const payload = exchangeEmail.trim()
      ? {
          targetRoomId,
          exchangeWithEmail: exchangeEmail.trim().toLowerCase(),
        }
      : {
          moves: [
            { userId, expectedRoomId: ownRoom?.id ?? null, targetRoomId },
          ],
        };
    const ok = await post(
      `/api/trips/${encodeURIComponent(tripId)}/room-requests`,
      payload,
    );
    if (ok) {
      setMessage(
        exchangeEmail.trim()
          ? "Votre proposition d’échange a été envoyée aux personnes concernées."
          : "Votre demande de chambre a été enregistrée.",
      );
      setTargetRoomId(null);
      setExchangeEmail("");
      await refresh();
    }
  }

  async function respond(requestId: string, approve: boolean) {
    const ok = await post(
      `/api/trips/${encodeURIComponent(tripId)}/room-requests/${encodeURIComponent(requestId)}/consent`,
      { approve },
    );
    if (ok) {
      setMessage(
        approve
          ? "Votre accord a été enregistré."
          : "La demande a été refusée.",
      );
      await refresh();
    }
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/rooms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          capacity: Number(roomCapacity),
        }),
      },
    );
    if (!response.ok) {
      setMessage(
        "Impossible de créer cette chambre. Vérifiez son nom et sa capacité.",
      );
      return;
    }
    setRoomName("");
    setRoomCapacity("4");
    setMessage("La chambre a été créée.");
    await refresh();
  }

  async function assignInitialRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!initialRoomId || !initialTravelerId) return;
    const ok = await post(
      `/api/trips/${encodeURIComponent(tripId)}/rooms/${encodeURIComponent(initialRoomId)}/initial-assignment`,
      { userId: initialTravelerId },
    );
    if (ok) {
      setMessage("La répartition a été mise à jour.");
      setInitialRoomId(null);
      setInitialTravelerId(null);
      await refresh();
    }
  }

  function selectChange(setter: (key: string | null) => void) {
    return (key: string | number | null) => setter(key ? String(key) : null);
  }

  if (status === "loading")
    return (
      <section className="rooming-section" aria-busy="true">
        <p role="status">Chargement du rooming…</p>
      </section>
    );
  if (status === "error")
    return (
      <section className="rooming-section">
        <h3>Chambres</h3>
        <p role="alert">
          La répartition des chambres est momentanément indisponible.
        </p>
      </section>
    );
  return (
    <section className="rooming-section" aria-labelledby="rooming-title">
      <div className="section-heading">
        <div>
          <h3 id="rooming-title">Chambres</h3>
          <p>Votre chambre et les demandes en attente.</p>
        </div>
      </div>
      {ownRoom ? (
        <article className="room-card">
          <div>
            <span className="detail-label">Votre chambre</span>
            <strong>{ownRoom.name}</strong>
          </div>
          <span className="count-pill">
            {ownRoom.occupiedCount}/{ownRoom.capacity} places
          </span>
          <ul>
            {ownRoom.occupants.map((person) => (
              <li key={person.userId}>
                {person.firstName} {person.lastName}
                {person.userId === userId ? " · vous" : ""}
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <p className="empty-state">
          Aucune chambre ne vous a encore été attribuée.
        </p>
      )}
      {isStaff && (
        <div className="room-admin-list">
          <h4>Répartition actuelle</h4>
          {rooms.map((room) => (
            <article className="room-card" key={room.id}>
              <div>
                <span className="detail-label">
                  {room.occupiedCount}/{room.capacity} places
                  {room.genderPolicy === "mixed" ? " · mixte validée" : ""}
                </span>
                <strong>{room.name}</strong>
              </div>
              {room.occupants.length ? (
                <ul>
                  {room.occupants.map((person) => (
                    <li key={person.userId}>
                      {person.firstName} {person.lastName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="detail-label">Chambre vide</p>
              )}
            </article>
          ))}
        </div>
      )}
      {targetRooms.length > 0 && (
        <Form className="room-request-form" onSubmit={requestChange}>
          <Select
            className="room-select"
            selectedKey={targetRoomId}
            onSelectionChange={(key) =>
              setTargetRoomId(key ? String(key) : null)
            }
            isRequired
          >
            <Label>Demander une place dans une autre chambre</Label>
            <Button className="select-trigger">
              <SelectValue />
            </Button>
            <Popover>
              <ListBox className="room-select-listbox">
                {targetRooms.map((room) => (
                  <ListBoxItem
                    className="room-select-option"
                    key={room.id}
                    id={room.id}
                    textValue={room.name}
                  >
                    {room.name} · {room.capacity - room.occupiedCount} place(s)
                    libre(s)
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
          {ownRoom && (
            <TextField
              type="email"
              value={exchangeEmail}
              onChange={setExchangeEmail}
            >
              <Label>
                E-mail de la personne avec qui échanger (si la chambre est
                complète)
              </Label>
              <Input autoComplete="email" />
            </TextField>
          )}
          <Button type="submit" className="secondary-action">
            {exchangeEmail.trim() ? "Proposer l’échange" : "Envoyer ma demande"}
          </Button>
        </Form>
      )}
      {requests.length > 0 && (
        <div className="room-requests">
          <h4>Demandes à valider</h4>
          {requests.map((request) => {
            const ownConsent = request.requiredConsents.find(
              (consent) => consent.userId === userId,
            );
            return (
              <article className="request-card" key={request.id}>
                <p>
                  {request.requester?.firstName} {request.requester?.lastName}{" "}
                  demande un changement de chambre.
                </p>
                <ul>
                  {request.moves.map((move) => (
                    <li key={move.userId}>
                      {move.person?.firstName} {move.person?.lastName} :{" "}
                      {move.currentRoom ?? "sans chambre"} → {move.targetRoom}
                    </li>
                  ))}
                </ul>
                {ownConsent && !ownConsent.approved && (
                  <div className="request-actions">
                    <Button
                      className="secondary-action"
                      onPress={() => void respond(request.id, true)}
                    >
                      J’accepte
                    </Button>
                    <Button
                      className="text-action"
                      onPress={() => void respond(request.id, false)}
                    >
                      Je refuse
                    </Button>
                  </div>
                )}
                {ownConsent?.approved && (
                  <p className="consent-state">
                    Votre accord est enregistré ·{" "}
                    {
                      request.requiredConsents.filter(
                        (consent) => consent.approved,
                      ).length
                    }
                    /{request.requiredConsents.length} accords
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {isStaff && (
        <div className="room-admin">
          <h4>Créer une chambre</h4>
          <Form className="room-request-form" onSubmit={createRoom}>
            <TextField value={roomName} onChange={setRoomName} isRequired>
              <Label>Nom de la chambre</Label>
              <Input placeholder="Ex. 101" maxLength={80} />
            </TextField>
            <TextField
              value={roomCapacity}
              onChange={setRoomCapacity}
              isRequired
            >
              <Label>Capacité</Label>
              <Input type="number" min="1" max="12" />
            </TextField>
            <Button className="secondary-action" type="submit">
              Créer
            </Button>
          </Form>
          {unassignedTravelers.length > 0 && availableRooms.length > 0 && (
            <Form className="room-request-form" onSubmit={assignInitialRoom}>
              <Select
                selectedKey={initialTravelerId}
                onSelectionChange={selectChange(setInitialTravelerId)}
                isRequired
              >
                <Label>Voyageur à placer</Label>
                <Button className="select-trigger">
                  <SelectValue />
                </Button>
                <Popover>
                  <ListBox className="room-select-listbox">
                    {unassignedTravelers.map((person) => (
                      <ListBoxItem
                        className="room-select-option"
                        key={person.userId}
                        id={person.userId}
                        textValue={`${person.firstName} ${person.lastName}`}
                      >
                        {person.firstName} {person.lastName} · {person.email}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
              <Select
                selectedKey={initialRoomId}
                onSelectionChange={selectChange(setInitialRoomId)}
                isRequired
              >
                <Label>Chambre avec une place libre</Label>
                <Button className="select-trigger">
                  <SelectValue />
                </Button>
                <Popover>
                  <ListBox className="room-select-listbox">
                    {availableRooms.map((room) => (
                      <ListBoxItem
                        className="room-select-option"
                        key={room.id}
                        id={room.id}
                        textValue={room.name}
                      >
                        {room.name} · {room.occupiedCount}/{room.capacity}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
              <Button className="secondary-action" type="submit">
                Attribuer
              </Button>
            </Form>
          )}
        </div>
      )}
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

const roomErrorLabel: Record<string, string> = {
  room_capacity_exceeded: "Cette chambre n’a plus de place.",
  room_composition_changed:
    "La composition de la chambre a changé. Actualisez la page.",
  room_change_requires_consents:
    "Un changement de chambre nécessite le consentement des personnes concernées.",
  consent_not_required: "Vous n’êtes pas concerné par cette demande.",
  invalid_room_exchange:
    "Impossible de retrouver cette personne dans la chambre sélectionnée.",
};

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

const transportLabel: Record<string, string> = {
  train: "Train",
  flight: "Avion",
  none: "Sans transport réservé",
};
const ticketLabel = { outbound: "Aller", return: "Retour", other: "Document" };

function formatDate(value?: string | null) {
  if (!value) return "À confirmer";
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(date);
}

function formatBytes(size: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(size / 1024)} Ko`;
}

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
