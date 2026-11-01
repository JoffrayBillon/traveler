import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { lazy, type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation } from "react-router";
import type { TravelerProfile } from "../../types/profile";
import { NotFound } from "./NotFound";

const OrganizerRoute = lazy(() =>
  import("./OrganizerRoute").then((module) => ({
    default: module.OrganizerRoute,
  })),
);
const TripRoute = lazy(() =>
  import("./TripRoute").then((module) => ({ default: module.TripRoute })),
);
const TripsHome = lazy(() =>
  import("../trips/TripsHome").then((module) => ({
    default: module.TripsHome,
  })),
);

export function AppRouteTree({
  profile,
  signInPage,
}: {
  profile: TravelerProfile | null;
  signInPage: ReactNode;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        className="min-h-px w-full"
        data-route-path={location.pathname}
        key={location.pathname}
        initial={
          reduceMotion ? false : { opacity: 0, y: 14, filter: "blur(5px)" }
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
        <Suspense fallback={<p role="status">{t("loadingYourSpace")}</p>}>
          <Routes location={location}>
            <Route
              path="/"
              element={profile ? <Navigate to="/trips" replace /> : signInPage}
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
              element={<Navigate to={profile ? "/trips" : "/"} replace />}
            />
            <Route
              path="*"
              element={profile ? <NotFound /> : <Navigate to="/" replace />}
            />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
