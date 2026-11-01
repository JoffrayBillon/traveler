import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useLocation, useNavigate } from "react-router";
import { AppFrame } from "../../components/AppFrame";
import { useThemePreference } from "../../hooks/useThemePreference";
import { ApiError, apiGet, apiPost } from "../../shared/api/client";
import { queryKeys } from "../../shared/query/query-keys";
import type { TravelerProfile } from "../../types/profile";
import { AppRouteTree } from "../routing/AppRouteTree";

const SIGN_IN_COOLDOWN_SECONDS = 30;
const SignInPage = lazy(() =>
  import("./SignInPage").then((module) => ({ default: module.SignInPage })),
);
export function TravelerApp() {
  const { t } = useTranslation();
  const queryCache = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [profileError, setProfileError] = useState("");
  const { preference, setPreference } = useThemePreference();
  const profileQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      try {
        return await apiGet<TravelerProfile>("/api/me", signal);
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status))
          return null;
        throw error;
      }
    },
  });
  const profile = profileQuery.data ?? null;
  const profileStatus: "checking" | "ready" | "unavailable" =
    profileQuery.isPending
      ? "checking"
      : profileQuery.isError
        ? "unavailable"
        : "ready";
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const signInMutation = useMutation({
    mutationFn: (emailAddress: string) =>
      apiPost("/api/auth/sign-in/magic-link", {
        email: emailAddress,
        callbackURL: `${window.location.origin}/`,
      }),
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
        setMessage(t("tooManyRequestsTryAgainInSecondsSeconds", { seconds }));
        return;
      }
      startCooldown(SIGN_IN_COOLDOWN_SECONDS);
      setHasError(true);
      setMessage(t("signInIsTemporarilyUnavailablePleaseTryAgainLater"));
    },
  });

  const signOutMutation = useMutation({
    mutationFn: () => apiPost("/api/auth/sign-out"),
    onSuccess: () => {
      queryCache.clear();
      navigate("/", { replace: true });
    },
    onError: () => setProfileError(t("signOutIsTemporarilyUnavailable")),
  });

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    const main = mainRef.current;
    if (!main) return;
    const focusHeading = () => {
      const route = [
        ...main.querySelectorAll<HTMLElement>("[data-route-path]"),
      ].find((element) => element.dataset.routePath === location.pathname);
      const heading = route?.querySelector<HTMLElement>("[data-route-heading]");
      if (!heading) return false;
      heading.focus();
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

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
    signInMutation.mutate(email);
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppFrame
        profile={profile}
        preference={preference}
        profileError={profileError}
        onPreferenceChange={setPreference}
        onSignOut={() => {
          setProfileError("");
          signOutMutation.mutate();
        }}
        mainRef={mainRef}
      >
        {profileStatus === "checking" ? (
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
          <AppRouteTree
            profile={profile}
            signInPage={
              <Suspense fallback={<p role="status">{t("loadingYourSpace")}</p>}>
                <SignInPage
                  email={email}
                  isSending={signInMutation.isPending || cooldownSeconds > 0}
                  message={message}
                  hasError={hasError}
                  profileError={
                    profileStatus === "unavailable"
                      ? t(
                          "yourSpaceIsTemporarilyUnavailablePleaseTryAgainShortly",
                        )
                      : ""
                  }
                  cooldownSeconds={cooldownSeconds}
                  onEmailChange={setEmail}
                  onSubmit={requestSignIn}
                />
              </Suspense>
            }
          />
        )}
      </AppFrame>
    </MotionConfig>
  );
}
