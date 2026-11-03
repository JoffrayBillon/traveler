import { AppFrame } from "@traveler/components/AppFrame";
import { LoadingIndicator } from "@traveler/components/ui";
import type { ThemePreference } from "@traveler/hooks/useThemePreference";
import type { TravelerProfile } from "@traveler/types/profile";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type RefObject, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutlet } from "react-router";

export function TravelerLayout({
  profile,
  preference,
  profileError,
  onPreferenceChange,
  onSignOut,
  mainRef,
}: {
  profile: TravelerProfile | null;
  preference: ThemePreference;
  profileError: string;
  onPreferenceChange: (preference: ThemePreference) => void;
  onSignOut: () => void;
  mainRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const outlet = useOutlet();
  const shouldReduceMotion = useReducedMotion();
  const isOrganizerRoute = location.pathname.endsWith("/organize");

  useEffect(() => {
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
  }, [location.pathname, mainRef]);

  return (
    <AppFrame
      profile={profile}
      preference={preference}
      profileError={profileError}
      onPreferenceChange={onPreferenceChange}
      onSignOut={onSignOut}
      mainRef={mainRef}
    >
      <div
        className={`relative w-full${isOrganizerRoute ? " self-start" : ""}`}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            className="min-h-px w-full"
            data-route-path={location.pathname}
            key={location.pathname}
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, y: 14, filter: "blur(5px)" }
            }
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -10, filter: "blur(4px)" }
            }
            transition={{
              duration: shouldReduceMotion ? 0 : 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Suspense
              fallback={<LoadingIndicator label={t("loadingYourSpace")} />}
            >
              {outlet}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppFrame>
  );
}
