import type { ThemePreference } from "@traveler/hooks/useThemePreference";
import type { TravelerProfile } from "@traveler/types/profile";
import { lazy, type ReactNode, type RefObject } from "react";
import { Navigate, Route, Routes } from "react-router";
import { NotFoundRoute } from "./NotFoundRoute";
import { TravelerLayout } from "./TravelerLayout";

const OrganizerRoute = lazy(() =>
  import("./OrganizerRoute").then((module) => ({
    default: module.OrganizerRoute,
  })),
);
const TripRoute = lazy(() =>
  import("./TripRoute").then((module) => ({
    default: module.TripRoute,
  })),
);

const TripsHome = lazy(() =>
  import("@traveler/features/trips/TripsHome").then((module) => ({
    default: module.TripsHome,
  })),
);

export function AppRoutes({
  profile,
  signInPage,
  preference,
  profileError,
  onPreferenceChange,
  onSignOut,
  mainRef,
}: {
  profile: TravelerProfile | null;
  signInPage: ReactNode;
  preference: ThemePreference;
  profileError: string;
  onPreferenceChange: (preference: ThemePreference) => void;
  onSignOut: () => void;
  mainRef: RefObject<HTMLElement | null>;
}) {
  return (
    <Routes>
      <Route
        element={
          <TravelerLayout
            profile={profile}
            preference={preference}
            profileError={profileError}
            onPreferenceChange={onPreferenceChange}
            onSignOut={onSignOut}
            mainRef={mainRef}
          />
        }
      >
        <Route
          index
          element={profile ? <Navigate to="/trips" replace /> : signInPage}
        />
        <Route
          path="trips"
          element={
            profile ? (
              <TripsHome profile={profile} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="trips/:tripId"
          element={
            profile ? (
              <TripRoute profile={profile} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="trips/:tripId/organize"
          element={
            profile ? (
              <OrganizerRoute profile={profile} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="account"
          element={<Navigate to={profile ? "/trips" : "/"} replace />}
        />
        <Route
          path="*"
          element={profile ? <NotFoundRoute /> : <Navigate to="/" replace />}
        />
      </Route>
    </Routes>
  );
}
