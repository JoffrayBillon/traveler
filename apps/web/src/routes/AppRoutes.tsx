import { LoadingIndicator } from "@traveler/components/ui";
import type { ThemePreference } from "@traveler/hooks/useThemePreference";
import type { TravelerProfile } from "@traveler/types/profile";
import { lazy, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
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
  profileStatus,
  signInPage,
  preference,
  profileError,
  onPreferenceChange,
  onSignOut,
  mainRef,
}: {
  profile: TravelerProfile | null;
  profileStatus: "checking" | "ready" | "unavailable";
  signInPage: ReactNode;
  preference: ThemePreference;
  profileError: string;
  onPreferenceChange: (preference: ThemePreference) => void;
  onSignOut: () => void;
  mainRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const loadingProfile = <LoadingIndicator label={t("loadingYourSpace")} />;

  function renderProtectedRoute(
    render: (profile: TravelerProfile) => ReactNode,
  ) {
    if (profileStatus === "checking") return loadingProfile;
    if (!profile) return <Navigate to="/" replace />;
    return render(profile);
  }

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
          element={renderProtectedRoute((currentProfile) => (
            <TripsHome profile={currentProfile} />
          ))}
        />
        <Route
          path="trips/:tripId"
          element={renderProtectedRoute((currentProfile) => (
            <TripRoute profile={currentProfile} />
          ))}
        />
        <Route
          path="trips/:tripId/organize"
          element={renderProtectedRoute((currentProfile) => (
            <OrganizerRoute profile={currentProfile} />
          ))}
        />
        <Route
          path="account"
          element={
            profileStatus === "checking" ? (
              loadingProfile
            ) : (
              <Navigate to={profile ? "/trips" : "/"} replace />
            )
          }
        />
        <Route
          path="*"
          element={renderProtectedRoute(() => <NotFoundRoute />)}
        />
      </Route>
    </Routes>
  );
}
