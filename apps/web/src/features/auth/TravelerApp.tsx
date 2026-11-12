import {
  useRequestMagicLinkMutation,
  useSignOutMutation,
} from "@traveler/api/auth/mutations";
import { useCurrentTravelerQuery } from "@traveler/api/auth/queries";
import { ApiError } from "@traveler/api/client";
import { LoadingIndicator } from "@traveler/components/ui";
import { useThemePreference } from "@traveler/hooks/useThemePreference";
import { AppRoutes } from "@traveler/routes/AppRoutes";
import { MountainSnow } from "lucide-react";
import { MotionConfig } from "motion/react";
import {
  type FormEvent,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

const SIGN_IN_COOLDOWN_SECONDS = 30;
const SignInPage = lazy(() =>
  import("./SignInPage").then((module) => ({ default: module.SignInPage })),
);

export function TravelerApp() {
  const { t } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const profileQuery = useCurrentTravelerQuery();
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [profileError, setProfileError] = useState("");
  const { preference, setPreference } = useThemePreference();
  const signInMutation = useRequestMagicLinkMutation();
  const signOutMutation = useSignOutMutation();
  const profile = profileQuery.data ?? null;
  const profileStatus: "checking" | "ready" | "unavailable" =
    profileQuery.isPending
      ? "checking"
      : profileQuery.isError
        ? "unavailable"
        : "ready";
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

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

  function requestSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signInMutation.isPending || cooldownSeconds > 0) return;
    setMessage("");
    setHasError(false);
    signInMutation.mutate(
      { email, callbackURL: `${window.location.origin}/` },
      {
        onSuccess: () => {
          startCooldown(SIGN_IN_COOLDOWN_SECONDS);
          setMessage(
            import.meta.env.DEV
              ? t(
                  "ifThisAddressIsAuthorizedItsSignInLinkIsShownInTheLocalApiTerminal",
                )
              : t("ifThisAddressIsAuthorizedASignInLinkHasBeenSent"),
          );
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 429) {
            const seconds = error.retryAfterSeconds ?? 60;
            startCooldown(seconds);
            setHasError(true);
            setMessage(
              t("tooManyRequestsTryAgainInSecondsSeconds", { seconds }),
            );
            return;
          }
          startCooldown(SIGN_IN_COOLDOWN_SECONDS);
          setHasError(true);
          setMessage(t("signInIsTemporarilyUnavailablePleaseTryAgainLater"));
        },
      },
    );
  }

  function signOut() {
    setProfileError("");
    signOutMutation.mutate(undefined, {
      onSuccess: () => navigate("/", { replace: true }),
      onError: () => setProfileError(t("signOutIsTemporarilyUnavailable")),
    });
  }

  const signInPage =
    profileStatus === "checking" ? (
      <section
        className="mx-auto flex w-full flex-1 items-center justify-center gap-4 px-6 text-content-muted"
        aria-busy="true"
        role="status"
      >
        <span className="grid size-[3.6rem] animate-[mark-breathe_1.8s_ease-in-out_infinite] place-items-center rounded-card bg-surface-muted text-accent">
          <MountainSnow aria-hidden="true" size={26} />
        </span>
        <p>{t("preparingYourSpace")}</p>
      </section>
    ) : (
      <Suspense fallback={<LoadingIndicator label={t("loadingYourSpace")} />}>
        <SignInPage
          email={email}
          isSending={signInMutation.isPending || cooldownSeconds > 0}
          message={message}
          hasError={hasError}
          profileError={
            profileStatus === "unavailable"
              ? t("yourSpaceIsTemporarilyUnavailablePleaseTryAgainShortly")
              : ""
          }
          cooldownSeconds={cooldownSeconds}
          onEmailChange={setEmail}
          onSubmit={requestSignIn}
        />
      </Suspense>
    );

  return (
    <MotionConfig reducedMotion="user">
      <AppRoutes
        profile={profile}
        profileStatus={profileStatus}
        signInPage={signInPage}
        preference={preference}
        profileError={profileError}
        onPreferenceChange={setPreference}
        onSignOut={signOut}
        mainRef={mainRef}
      />
    </MotionConfig>
  );
}
