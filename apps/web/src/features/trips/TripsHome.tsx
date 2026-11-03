import { PageContainer } from "@traveler/components/ui";
import { roleLabel } from "@traveler/lib/trip-format";
import type { TravelerProfile } from "@traveler/types/profile";
import { ArrowUpRight, MountainSnow, Snowflake } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function TripsHome({ profile }: { profile: TravelerProfile }) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <PageContainer as="section" spacing="regular" aria-labelledby="trips-title">
      <header className="relative isolate flex min-h-[330px] items-center justify-between overflow-hidden rounded-feature border border-border/80 bg-[linear-gradient(118deg,var(--theme-color-surface)_5%,var(--theme-color-surface-muted)_100%)] p-[clamp(2rem,5vw,4.5rem)] shadow-panel max-[760px]:min-h-[300px] max-[760px]:p-7">
        <div className="relative z-10 grid gap-4">
          <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.14em] text-accent">
            <MountainSnow aria-hidden="true" size={16} /> {t("yourTravelSpace")}
          </p>
          <h1
            className="text-[clamp(2.7rem,5vw,4.4rem)] font-bold leading-none tracking-[-0.075em] text-content max-[760px]:text-[clamp(2.5rem,10vw,3.6rem)]"
            id="trips-title"
            data-route-heading
            tabIndex={-1}
          >
            {t("helloName", {
              name: profile.user.name.split(" ")[0] ?? profile.user.name,
            })}
            <span className="text-accent-warm">.</span>
          </h1>
          <p className="text-lg text-content-muted">
            {t("greatTripsStartHere")}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-extrabold tracking-[-0.07em]">
              {String(profile.trips.length).padStart(2, "0")}
            </span>
            <span className="text-xs font-extrabold leading-[1.45] tracking-[0.12em] text-content-muted">
              {profile.trips.length === 1
                ? t("countTrip", { count: 1 })
                : t("countTrips", { count: profile.trips.length })}
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
        <a
          className="absolute bottom-3 right-3 z-10 text-[0.625rem] text-white/70 opacity-50 transition-opacity hover:opacity-80 focus-visible:opacity-100"
          href="https://unsplash.com/photos/an-aerial-view-of-a-snow-covered-ski-slope-VUtGlHWYMVU"
          target="_blank"
          rel="noreferrer"
        >
          {t("photoBy")} {t("sirisvisualUnsplash")}
        </a>
      </header>

      <div className="grid gap-5">
        <div className="flex items-end justify-between gap-6 max-[480px]:items-start max-[480px]:flex-col max-[480px]:gap-3">
          <div className="grid gap-1">
            <p className="text-xs font-extrabold tracking-[0.14em] text-accent">
              {t("yourItinerary")}
            </p>
            <h2 className="text-3xl tracking-[-0.05em]">{t("yourTrips")}</h2>
          </div>
          <span className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-content-muted">
            {profile.trips.length === 1
              ? t("countStay", { count: 1 })
              : t("countStays", { count: profile.trips.length })}
          </span>
        </div>

        {profile.trips.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-5 leading-relaxed text-content-muted">
            {t(
              "noTripsAreLinkedToYourAccountYetContactTheOrganizersIfYouThinkThisIsAMistake",
            )}
          </p>
        ) : (
          <motion.ul
            className="grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] gap-4 p-0"
            layout={!shouldReduceMotion}
          >
            {profile.trips.map((trip, index) => (
              <motion.li
                className="min-h-[210px] overflow-hidden rounded-card border border-border bg-surface shadow-card transition-colors hover:border-accent"
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
                  className="flex min-h-[210px] flex-col justify-between gap-4 p-6 text-content no-underline"
                  to={`/trips/${encodeURIComponent(trip.tripId)}`}
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="grid size-12 place-items-center rounded-card bg-surface-muted text-accent">
                      <Snowflake aria-hidden="true" size={20} />
                    </span>
                    <span className="flex items-center gap-2 text-xs font-extrabold tracking-[0.08em] text-content-subtle">
                      <span className="size-2 rounded-full bg-success shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-color-success),transparent_82%)]" />
                      {t("activeTrip")}
                    </span>
                  </span>
                  <span className="text-2xl font-bold tracking-[-0.04em]">
                    {trip.tripName}
                  </span>
                  <span className="flex items-center justify-between gap-4">
                    <span className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-content-muted">
                      {t(roleLabel[trip.role])}
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-accent">
                      {t("explore")}{" "}
                      <ArrowUpRight aria-hidden="true" size={17} />
                    </span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-card border border-border bg-surface px-6 py-5 leading-relaxed text-content-muted">
        <span className="text-accent">
          <MountainSnow aria-hidden="true" size={19} />
        </span>
        <p>
          <strong>{t("somethingChanged")}</strong>{" "}
          {t(
            "yourOrganizersWillKeepYourTicketsScheduleAndRoomDetailsUpToDateHere",
          )}
        </p>
      </div>
    </PageContainer>
  );
}
