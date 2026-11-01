import { buttonStyles, eyebrowStyles } from "@traveler/components/ui";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function NotFoundRoute() {
  const { t } = useTranslation();
  return (
    <section
      className="mx-auto grid min-h-[45vh] w-[min(100%-3rem,1320px)] content-center justify-items-center gap-5 py-12 text-center max-[760px]:w-[min(100%-2rem,1320px)] max-[760px]:py-6"
      aria-labelledby="not-found-title"
    >
      <p className={eyebrowStyles()}>{t("pageNotFound")}</p>
      <h1
        className="text-[clamp(2rem,4vw,3.4rem)] font-bold leading-tight tracking-[-0.06em] text-content"
        id="not-found-title"
        data-route-heading
        tabIndex={-1}
      >
        {t("thisPageCouldNotBeFound")}
      </h1>
      <Link
        className={buttonStyles({
          appearance: "primary",
          class: "no-underline",
        })}
        to="/trips"
      >
        {t("backToMyTrips")}
      </Link>
    </section>
  );
}
