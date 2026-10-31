import { ArrowUpRight, MountainSnow, Snowflake } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router";
import { roleLabel } from "../../lib/trip-format";
import type { TravelerProfile } from "../../types/profile";

export function TripsHome({ profile }: { profile: TravelerProfile }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      className="mx-auto my-12 mb-20 w-[min(100%-3rem,1120px)] max-[760px]:my-6 max-[760px]:mb-12 max-[760px]:w-[min(100%-2rem,1120px)]"
      aria-labelledby="trips-title"
    >
      <header className="relative isolate flex min-h-[330px] items-center justify-between overflow-hidden rounded-[1.6rem] border border-[color-mix(in_srgb,var(--line),transparent_18%)] bg-[linear-gradient(118deg,var(--surface)_5%,var(--surface-soft)_100%)] p-[clamp(2rem,5vw,4.5rem)] shadow-[var(--shadow)] max-[760px]:min-h-[300px] max-[760px]:p-7">
        <div className="relative z-10">
          <p className="flex items-center gap-2 text-[0.73rem] font-extrabold tracking-[0.14em] text-[var(--forest-bright)]">
            <MountainSnow aria-hidden="true" size={16} /> VOTRE ESPACE VOYAGE
          </p>
          <h1
            className="mt-5 text-[clamp(2.7rem,5vw,4.4rem)] font-bold leading-none tracking-[-0.075em] text-[var(--ink)] max-[760px]:text-[clamp(2.5rem,10vw,3.6rem)]"
            id="trips-title"
          >
            Bonjour {profile.user.name.split(" ")[0]}
            <span className="text-[var(--sun)]">.</span>
          </h1>
          <p className="text-[1.1rem] text-[var(--muted)]">
            Les beaux départs se préparent ici.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <span className="text-[2.4rem] font-extrabold tracking-[-0.07em]">
              {String(profile.trips.length).padStart(2, "0")}
            </span>
            <span className="text-[0.67rem] font-extrabold leading-[1.45] tracking-[0.12em] text-[var(--muted)]">
              VOYAGE{profile.trips.length > 1 ? "S" : ""}
            </span>
          </div>
        </div>
        <div
          className="absolute -z-10 right-0 top-0 h-full w-[47%] opacity-90 [mask-image:linear-gradient(90deg,transparent,#000_34%)] max-[760px]:w-[72%] max-[760px]:opacity-40 max-[760px]:[mask-image:linear-gradient(90deg,transparent,#000_65%)]"
          aria-hidden="true"
        >
          <img
            className="h-full w-full object-cover [object-position:center_42%]"
            src="https://images.unsplash.com/photo-1646841038547-a3062b1ad756?auto=format&fit=crop&w=1200&q=82"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
      </header>
      <p className="my-2 mb-8 text-right text-xs text-[var(--quiet)]">
        Photo de{" "}
        <a
          href="https://unsplash.com/photos/an-aerial-view-of-a-snow-covered-ski-slope-VUtGlHWYMVU"
          target="_blank"
          rel="noreferrer"
        >
          Sirisvisual · Unsplash
        </a>
      </p>

      <div className="mb-5 mt-12 flex items-end justify-between gap-6 max-[480px]:mt-8 max-[480px]:items-start max-[480px]:flex-col max-[480px]:gap-3">
        <div>
          <p className="m-0 text-[0.73rem] font-extrabold tracking-[0.14em] text-[var(--forest-bright)]">
            VOTRE PROGRAMME
          </p>
          <h2 className="mb-0 mt-1 text-[2rem] tracking-[-0.05em]">
            Vos voyages
          </h2>
        </div>
        <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[0.78rem] font-semibold text-[var(--muted)]">
          {profile.trips.length} séjour{profile.trips.length > 1 ? "s" : ""}
        </span>
      </div>

      {profile.trips.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 leading-relaxed text-[var(--muted)]">
          Aucun voyage n’est encore rattaché à votre espace. Contactez
          l’organisation si cela vous semble incorrect.
        </p>
      ) : (
        <motion.ul
          className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] gap-4 p-0"
          layout={!shouldReduceMotion}
        >
          {profile.trips.map((trip, index) => (
            <motion.li
              className="min-h-[210px] overflow-hidden rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_16px_45px_rgb(29_52_43/6%)] transition-colors hover:border-[var(--forest-bright)]"
              key={trip.tripId}
              layout={!shouldReduceMotion}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.32,
                delay: shouldReduceMotion ? 0 : index * 0.07,
              }}
              {...(shouldReduceMotion ? {} : { whileHover: { y: -5 } })}
            >
              <Link
                className="flex min-h-[210px] flex-col justify-between p-6 text-[var(--ink)] no-underline"
                to={`/trips/${encodeURIComponent(trip.tripId)}`}
              >
                <span className="flex items-center justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-[var(--surface-soft)] text-[var(--forest-bright)]">
                    <Snowflake aria-hidden="true" size={20} />
                  </span>
                  <span className="flex items-center gap-2 text-[0.67rem] font-extrabold tracking-[0.08em] text-[var(--quiet)]">
                    <span className="size-2 rounded-full bg-[#67a779] shadow-[0_0_0_4px_color-mix(in_srgb,#67a779,transparent_82%)]" />{" "}
                    ESPACE ACTIF
                  </span>
                </span>
                <span className="my-6 text-[1.4rem] font-bold tracking-[-0.04em]">
                  {trip.tripName}
                </span>
                <span className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[0.78rem] font-semibold text-[var(--muted)]">
                    {roleLabel[trip.role]}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--forest-bright)]">
                    Découvrir <ArrowUpRight aria-hidden="true" size={17} />
                  </span>
                </span>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <div className="mt-10 flex items-center gap-4 rounded-[1.1rem] border border-[var(--line)] bg-[var(--surface)] px-6 py-5 leading-relaxed text-[var(--muted)]">
        <span className="text-[var(--forest-bright)]">
          <MountainSnow aria-hidden="true" size={19} />
        </span>
        <p className="m-0">
          <strong>Un détail change ?</strong> Votre équipe mettra les billets,
          horaires et informations de chambre à jour ici.
        </p>
      </div>
    </section>
  );
}
