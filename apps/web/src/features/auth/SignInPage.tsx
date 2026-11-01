import { ArrowRight, LockKeyhole, MountainSnow } from "lucide-react";
import { Form, Input, Label, Text, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Button, textFieldStyles } from "../../components/ui";

const heroPhoto =
  "https://images.unsplash.com/photo-1708213267571-07086f55dc5a?auto=format&fit=crop&w=1800&q=88";

export function SignInPage({
  email,
  isSending,
  message,
  hasError,
  profileError,
  cooldownSeconds,
  onEmailChange,
  onSubmit,
}: {
  email: string;
  isSending: boolean;
  message: string;
  hasError: boolean;
  profileError: string;
  cooldownSeconds: number;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="mx-auto grid min-h-[min(690px,calc(100dvh-180px))] w-[min(100%-3rem,1440px)] grid-cols-[minmax(340px,0.83fr)_minmax(0,1.17fr)] items-center gap-[clamp(2rem,7vw,6.5rem)] py-8 max-[760px]:min-h-0 max-[760px]:w-[min(100%-2rem,560px)] max-[760px]:grid-cols-1 max-[760px]:gap-6 max-[760px]:py-4"
      aria-labelledby="welcome-title"
    >
      <div className="grid max-w-[470px] content-center gap-5 py-8 max-[760px]:py-4">
        <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.14em] text-accent">
          <MountainSnow aria-hidden="true" size={16} />
          {t("yourTripStartsHere")}
        </p>
        <h1
          className="text-[clamp(3rem,6.7vw,5.7rem)] font-bold leading-[0.98] tracking-[-0.075em] text-content max-[760px]:text-[clamp(3rem,12vw,4.6rem)]"
          id="welcome-title"
          data-route-heading
          tabIndex={-1}
        >
          {t("theMountains")}
          <br />
          {t("areCalling")}
          <span className="text-accent-warm">.</span>
        </h1>
        <p className="max-w-[390px] text-lg leading-[1.7] text-content-muted">
          {t("yourStayTicketsAndRoomEverythingYouNeedForACarefreeTrip")}
        </p>
        <Form className="grid gap-5" onSubmit={onSubmit}>
          <TextField
            className="grid gap-2"
            type="email"
            value={email}
            onChange={onEmailChange}
            isRequired
            autoComplete="email"
          >
            <Label className="block text-sm font-bold text-content">
              {t("yourEmailAddress")}
            </Label>
            <Input
              className={textFieldStyles().input()}
              placeholder={t("youExampleCom")}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <Text
              className="block text-sm text-content-subtle"
              slot="description"
            >
              {t("useTheEmailAddressYouSharedWithTheOrganizers")}
            </Text>
          </TextField>
          <Button
            appearance="primary"
            className="gap-3 px-5 disabled:cursor-wait disabled:opacity-80"
            type="submit"
            isDisabled={isSending}
          >
            {isSending
              ? cooldownSeconds > 0
                ? t("tryAgainInSecondsSec", {
                    seconds: cooldownSeconds,
                  })
                : t("sending")
              : t("sendMeASignInLink")}
            {!isSending && <ArrowRight aria-hidden="true" size={18} />}
          </Button>
        </Form>
        {(message || profileError) && (
          <div className="grid gap-3">
            {message && (
              <div
                className={`leading-relaxed ${hasError ? "text-danger" : "text-success"}`}
                role={hasError ? "alert" : "status"}
              >
                {message}
              </div>
            )}
            {profileError && (
              <p className="leading-relaxed text-danger" role="alert">
                {profileError}
              </p>
            )}
          </div>
        )}
        <p className="flex items-center gap-2 text-sm text-content-subtle">
          <LockKeyhole aria-hidden="true" size={15} />{" "}
          {t("aPrivateSpaceForInvitedParticipants")}
        </p>
      </div>
      <figure className="relative isolate min-h-[570px] overflow-hidden rounded-feature bg-[#78939c] shadow-panel max-[760px]:min-h-[330px] max-[760px]:row-start-1">
        <img
          className="absolute inset-0 -z-10 h-full w-full animate-[photo-arrive_1.2s_cubic-bezier(0.2,0.8,0.2,1)_both] object-cover object-center"
          src={heroPhoto}
          alt=""
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(8_20_18/1%)_30%,rgb(8_20_18/72%)_100%)]" />
        <figcaption className="absolute inset-x-8 bottom-8 grid gap-3 text-white">
          <span className="text-xs font-bold tracking-[0.15em]">
            {t("les3ValleesFrenchAlps")}
          </span>
          <span className="text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.045em]">
            {t("whereWinterComesAlive")}
          </span>
        </figcaption>
        <a
          className="absolute bottom-4 right-4 z-10 text-[0.625rem] text-white/70 opacity-50 transition-opacity hover:opacity-80 focus-visible:opacity-100"
          href="https://unsplash.com/photos/a-ski-lift-going-up-a-snowy-mountain-F_DifgQCPDc"
          target="_blank"
          rel="noreferrer"
        >
          {t("photoByKarelMistrikUnsplash")}
        </a>
        <span
          className="absolute right-7 top-7 flex items-center gap-3 text-xs font-bold text-white"
          aria-hidden="true"
        >
          01 <span className="h-px w-14 bg-white/70" /> 03
        </span>
      </figure>
    </section>
  );
}
