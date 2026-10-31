import { ArrowUpRight, MountainSnow, Snowflake } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { roleLabel } from "../../lib/trip-format";
import type { TravelerProfile } from "../../types/profile";

export function TripsHome({ profile }: { profile: TravelerProfile }) {
  return (
    <section className="trips-home" aria-labelledby="trips-title">
      <header className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">
            <MountainSnow aria-hidden="true" size={16} /> VOTRE ESPACE VOYAGE
          </p>
          <h1 id="trips-title">
            Bonjour {profile.user.name.split(" ")[0]}
            <span>.</span>
          </h1>
          <p>Les beaux départs se préparent ici.</p>
          <div className="dashboard-count">
            <span>{String(profile.trips.length).padStart(2, "0")}</span>
            <span>
              VOYAGE{profile.trips.length > 1 ? "S" : ""}
              <br />À VENIR
            </span>
          </div>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <div className="dashboard-sun" />
          <div className="dashboard-peak dashboard-peak-back" />
          <div className="dashboard-peak dashboard-peak-front" />
          <Snowflake className="dashboard-snowflake" size={26} />
        </div>
        <div className="dashboard-photo" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1646841038547-a3062b1ad756?auto=format&fit=crop&w=1200&q=82"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
      </header>
      <p className="dashboard-photo-credit">
        Photo de{" "}
        <a
          href="https://unsplash.com/photos/an-aerial-view-of-a-snow-covered-ski-slope-VUtGlHWYMVU"
          target="_blank"
          rel="noreferrer"
        >
          Sirisvisual · Unsplash
        </a>
      </p>

      <div className="trip-list-heading">
        <div>
          <p className="eyebrow">VOTRE PROGRAMME</p>
          <h2>Vos voyages</h2>
        </div>
        <span className="trip-count-pill">
          {profile.trips.length} séjour{profile.trips.length > 1 ? "s" : ""}
        </span>
      </div>

      {profile.trips.length === 0 ? (
        <p className="empty-state">
          Aucun voyage n’est encore rattaché à votre espace. Contactez
          l’organisation si cela vous semble incorrect.
        </p>
      ) : (
        <motion.ul className="trip-card-grid" layout>
          {profile.trips.map((trip, index) => (
            <motion.li
              className="trip-card"
              key={trip.tripId}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: index * 0.07 }}
              whileHover={{ y: -5 }}
            >
              <Link
                className="trip-card-link"
                to={`/trips/${encodeURIComponent(trip.tripId)}`}
              >
                <span className="trip-card-topline">
                  <span className="trip-icon-badge">
                    <Snowflake aria-hidden="true" size={20} />
                  </span>
                  <span className="trip-status">
                    <span /> ESPACE ACTIF
                  </span>
                </span>
                <span className="trip-card-title">{trip.tripName}</span>
                <span className="trip-card-footer">
                  <span className="role-chip">{roleLabel[trip.role]}</span>
                  <span className="trip-card-open">
                    Découvrir <ArrowUpRight aria-hidden="true" size={17} />
                  </span>
                </span>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <div className="dashboard-tip">
        <span className="tip-icon">
          <MountainSnow aria-hidden="true" size={19} />
        </span>
        <p>
          <strong>Un détail change ?</strong> Votre équipe mettra les billets,
          horaires et informations de chambre à jour ici.
        </p>
      </div>
    </section>
  );
}
