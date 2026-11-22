import { PageContainer, Stack } from "@traveler/components/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function LegalAndPrivacyRoute() {
  const { t } = useTranslation();
  const title = t("legalAndPrivacyTitle");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} · Traveler`;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  return (
    <PageContainer as="article" width="narrow" aria-labelledby="legal-title">
      <Stack gap="sm">
        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          id="legal-title"
          data-route-heading
          tabIndex={-1}
        >
          {title}
        </h1>
        <p className="leading-relaxed text-content-muted">{t("legalIntro")}</p>
      </Stack>
      <Stack className="leading-relaxed text-content-muted" gap="xl">
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold text-content">
            {t("legalDataUseTitle")}
          </h2>
          <p>{t("legalDataUseDescription")}</p>
          <p>{t("legalProfileDataDescription")}</p>
          <p>{t("legalSessionDescription")}</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold text-content">
            {t("legalDataAccessTitle")}
          </h2>
          <p>{t("legalDataAccessDescription")}</p>
          <p>{t("legalProvidersDescription")}</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold text-content">
            {t("legalRetentionTitle")}
          </h2>
          <p>{t("legalTripRetentionDescription")}</p>
          <p>{t("legalAccountRetentionDescription")}</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold text-content">
            {t("legalRightsTitle")}
          </h2>
          <p>{t("legalRightsDescription")}</p>
          <p>{t("legalAccountRemovalDescription")}</p>
          <p>
            <a
              className="underline underline-offset-4 hover:text-content"
              href="https://www.cnil.fr/fr/adresser-une-plainte"
            >
              {t("legalCnilComplaint")}
            </a>
          </p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold text-content">
            {t("legalHostingTitle")}
          </h2>
          <p>{t("legalHostingDescription")}</p>
        </section>
      </Stack>
    </PageContainer>
  );
}
