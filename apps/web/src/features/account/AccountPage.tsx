import { ArrowLeft, LogOut, UserRound } from "lucide-react";
import { Button } from "react-aria-components";
import { Link } from "react-router";
import type { TravelerProfile } from "../../types/profile";

export function AccountPage({
  profile,
  profileError,
  onSignOut,
}: {
  profile: TravelerProfile;
  profileError: string;
  onSignOut: () => void;
}) {
  return (
    <section className="account-page" aria-labelledby="account-title">
      <Link className="back-link" to="/trips">
        <ArrowLeft aria-hidden="true" size={17} /> Mes voyages
      </Link>
      <div className="account-card">
        <div className="account-avatar">
          <UserRound aria-hidden="true" size={25} />
        </div>
        <div className="account-details">
          <p className="eyebrow">VOTRE PROFIL</p>
          <h1 id="account-title">{profile.user.name}</h1>
          <span className="detail-label">Adresse e-mail</span>
          <strong>{profile.user.email}</strong>
          <span className="detail-label">Voyages rattachés</span>
          <strong>{profile.trips.length}</strong>
        </div>
        <Button className="sign-out-button" onPress={onSignOut}>
          <LogOut aria-hidden="true" size={17} /> Se déconnecter
        </Button>
      </div>
      {profileError && (
        <p className="form-message error-message" role="alert">
          {profileError}
        </p>
      )}
    </section>
  );
}
