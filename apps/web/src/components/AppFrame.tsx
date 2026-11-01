import { LockKeyhole, MountainSnow } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router";
import type { ThemePreference } from "../hooks/useThemePreference";
import type { TravelerProfile } from "../types/profile";
import { ProfileMenu } from "./ProfileMenu";
import { appFrameStyles } from "./ui/layout.styles";

export function AppFrame({
  profile,
  preference,
  profileError,
  onPreferenceChange,
  onSignOut,
  mainRef,
  children,
}: {
  profile: TravelerProfile | null;
  preference: ThemePreference;
  profileError: string;
  onPreferenceChange: (preference: ThemePreference) => void;
  onSignOut: () => void;
  mainRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const styles = appFrameStyles();

  return (
    <div className={styles.root()}>
      <a
        className="absolute left-4 top-[-6rem] z-10 rounded-lg bg-action px-4 py-3 font-bold text-white focus:top-4"
        href="#main"
      >
        {t("skipToContent")}
      </a>
      <header className={styles.header()}>
        <Link
          className={styles.brand()}
          to={profile ? "/trips" : "/"}
          aria-label={t("travelerHome")}
        >
          <span className={styles.brandMark()} aria-hidden="true">
            <MountainSnow size={22} />
          </span>
          <span className={styles.brandName()}>
            traveler<span>.</span>
          </span>
        </Link>
        <div className={styles.headerActions()}>
          {profile ? (
            <nav
              className={styles.navigation()}
              aria-label={t("mainNavigation")}
            >
              <NavLink className={styles.navigationLink()} to="/trips">
                {t("myTrips")}
              </NavLink>
            </nav>
          ) : (
            <span className={styles.privateAccess()}>
              <LockKeyhole aria-hidden="true" size={15} /> {t("privateAccess")}
            </span>
          )}
          {profile && (
            <ProfileMenu
              profile={profile}
              preference={preference}
              profileError={profileError}
              onPreferenceChange={onPreferenceChange}
              onSignOut={onSignOut}
            />
          )}
        </div>
      </header>
      <main
        ref={mainRef}
        className={styles.main()}
        id="main"
        aria-label={t("pageContent")}
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className={styles.footer()}>
        <span>
          <strong className="text-sm font-extrabold tracking-[-0.04em] text-content-muted">
            Traveler<span className="text-accent-warm">.</span>
          </strong>
        </span>
        <span>{t("tripsAreBetterWhenEverythingIsClear")}</span>
      </footer>
    </div>
  );
}
