import { AppFrame } from "@traveler/components/AppFrame";
import type { ThemePreference } from "@traveler/hooks/useThemePreference";
import type { TravelerProfile } from "@traveler/types/profile";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type RefObject, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router";

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
  const shouldReduceMotion = useReducedMotion();

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
      <AnimatePresence mode="wait" initial={false}>
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
          {...(shouldReduceMotion
            ? {}
            : { exit: { opacity: 0, y: -10, filter: "blur(4px)" } })}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.28,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Suspense fallback={<p role="status">{t("loadingYourSpace")}</p>}>
            <Outlet />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </AppFrame>
  );
}
