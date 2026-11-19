import { useMagicLinkPreview } from "@traveler/api/auth/queries";
import { ApiError } from "@traveler/api/client";
import { Button, Card, LoadingIndicator } from "@traveler/components/ui";
import { useState } from "react";
import { Form } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

export function SignInConfirmationRoute() {
  const { t } = useTranslation();
  const location = useLocation();
  const parameters = new URLSearchParams(location.hash.slice(1));
  const token = parameters.get("token") ?? "";
  const preview = useMagicLinkPreview(token);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const invalid = !token || preview.isError;

  return (
    <Card
      as="section"
      spacing="comfortable"
      arrangement="stack"
      className="mx-auto my-8 w-full max-w-lg"
      aria-labelledby="confirm-sign-in-title"
    >
      <h1
        id="confirm-sign-in-title"
        className="text-2xl font-bold"
        data-route-heading
        tabIndex={-1}
      >
        {t("confirmSignInTitle")}
      </h1>
      {invalid ? (
        <>
          <p role="alert">
            {t(
              !token ||
                (preview.error instanceof ApiError &&
                  preview.error.status === 410)
                ? "signInLinkInvalid"
                : "signInIsTemporarilyUnavailablePleaseTryAgainLater",
            )}
          </p>
          <Link to="/">{t("requestNewSignInLink")}</Link>
        </>
      ) : preview.isPending ? (
        <LoadingIndicator label={t("checkingSignInLink")} />
      ) : (
        <>
          <p>
            {t("confirmSignInIdentity", {
              name: `${preview.data.firstName} ${preview.data.lastName}`,
            })}
          </p>
          <p className="text-sm text-content-muted">
            {t("confirmSignInDescription")}
          </p>
          <Form
            action="/api/auth/magic-link/verify"
            method="post"
            onSubmit={() => setIsSubmitting(true)}
          >
            <input type="hidden" name="token" value={token} />
            <input
              type="hidden"
              name="callbackURL"
              value={parameters.get("callbackURL") || "/"}
            />
            {parameters.get("newUserCallbackURL") && (
              <input
                type="hidden"
                name="newUserCallbackURL"
                value={parameters.get("newUserCallbackURL") ?? ""}
              />
            )}
            <Button
              type="submit"
              appearance="primary"
              fullWidth
              isDisabled={isSubmitting}
            >
              {isSubmitting ? t("signingIn") : t("confirmSignInButton")}
            </Button>
          </Form>
          <Link to="/">{t("signInAsSomeoneElse")}</Link>
        </>
      )}
    </Card>
  );
}
