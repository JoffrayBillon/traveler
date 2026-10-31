import { ArrowLeft, LogOut, UserRound } from "lucide-react";
import { Link } from "react-router";
import { Button, messageStyles } from "../../components/ui";
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
    <section
      className="mx-auto my-12 mb-20 w-[min(100%-3rem,1120px)] max-[760px]:my-6 max-[760px]:mb-12 max-[760px]:w-[min(100%-2rem,1120px)]"
      aria-labelledby="account-title"
    >
      <Link
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] no-underline hover:text-[var(--forest-bright)]"
        to="/trips"
      >
        <ArrowLeft aria-hidden="true" size={17} /> Mes voyages
      </Link>
      <div className="flex items-center gap-6 rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-[clamp(1.5rem,4vw,2.5rem)] shadow-[var(--shadow)] max-[760px]:flex-wrap max-[760px]:items-start">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[var(--surface-soft)] text-[var(--forest-bright)]">
          <UserRound aria-hidden="true" size={25} />
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(120px,auto)_1fr] items-baseline gap-x-6 gap-y-1 max-[760px]:min-w-[calc(100%-6rem)] max-[760px]:grid-cols-1 max-[760px]:gap-1">
          <p className="col-span-full m-0 text-[0.7rem] font-bold tracking-[0.14em] text-[var(--forest-bright)]">
            VOTRE PROFIL
          </p>
          <h1
            className="col-span-full my-1 text-[clamp(2rem,4vw,3.4rem)] tracking-[-0.06em]"
            id="account-title"
            data-route-heading
            tabIndex={-1}
          >
            {profile.user.name}
          </h1>
          <span className="text-[0.77rem] text-[var(--quiet)]">
            Adresse e-mail
          </span>
          <strong className="min-w-0 break-words text-[0.9rem] text-[var(--ink)]">
            {profile.user.email}
          </strong>
          <span className="mt-[0.6rem] text-[0.77rem] text-[var(--quiet)] max-[760px]:mt-2">
            Voyages rattachés
          </span>
          <strong className="min-w-0 break-words text-[0.9rem] text-[var(--ink)]">
            {profile.trips.length}
          </strong>
        </div>
        <Button
          appearance="secondary"
          className="py-3 max-[760px]:w-full"
          onPress={onSignOut}
        >
          <LogOut aria-hidden="true" size={17} /> Se déconnecter
        </Button>
      </div>
      {profileError && (
        <p className={messageStyles({ tone: "danger" })} role="alert">
          {profileError}
        </p>
      )}
    </section>
  );
}
