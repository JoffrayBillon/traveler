import { ArrowRight, LockKeyhole, MountainSnow } from "lucide-react";
import { Form, Input, Label, Text, TextField } from "react-aria-components";
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
  return (
    <section
      className="mx-auto my-8 grid min-h-[min(690px,calc(100dvh-180px))] w-[min(100%-3rem,1180px)] grid-cols-[minmax(340px,0.83fr)_minmax(0,1.17fr)] items-center gap-[clamp(2rem,7vw,6.5rem)] max-[760px]:my-4 max-[760px]:min-h-0 max-[760px]:w-[min(100%-2rem,560px)] max-[760px]:grid-cols-1 max-[760px]:gap-6"
      aria-labelledby="welcome-title"
    >
      <div className="max-w-[470px] py-8 max-[760px]:py-4">
        <p className="flex items-center gap-2 text-[0.73rem] font-extrabold tracking-[0.14em] text-[var(--forest-bright)]">
          <MountainSnow aria-hidden="true" size={16} />
          LE VOYAGE COMMENCE ICI
        </p>
        <h1
          className="my-5 text-[clamp(3rem,6.7vw,5.7rem)] font-bold leading-[0.98] tracking-[-0.075em] text-[var(--ink)] max-[760px]:text-[clamp(3rem,12vw,4.6rem)]"
          id="welcome-title"
          data-route-heading
          tabIndex={-1}
        >
          La montagne
          <br />
          vous appelle<span className="text-[var(--sun)]">.</span>
        </h1>
        <p className="max-w-[390px] text-[1.08rem] leading-[1.7] text-[var(--muted)]">
          Votre séjour, vos billets, votre chambre. Tout ce qu’il faut pour
          partir l’esprit libre.
        </p>
        <Form className="mt-8 grid gap-[1.15rem]" onSubmit={onSubmit}>
          <TextField
            className="grid gap-2"
            type="email"
            value={email}
            onChange={onEmailChange}
            isRequired
            autoComplete="email"
          >
            <Label className="mb-1 block text-[0.9rem] font-bold text-[var(--ink)]">
              Votre adresse e-mail
            </Label>
            <Input
              className={textFieldStyles().input()}
              placeholder="vous@exemple.fr"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <Text
              className="mt-1 block text-[0.82rem] text-[var(--quiet)]"
              slot="description"
            >
              Utilisez l’adresse communiquée à l’organisation.
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
                ? `Réessayez dans ${cooldownSeconds} s`
                : "Envoi en cours…"
              : "Recevoir mon lien de connexion"}
            {!isSending && <ArrowRight aria-hidden="true" size={18} />}
          </Button>
        </Form>
        {message && (
          <div
            className={`mt-4 leading-relaxed ${hasError ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
            role={hasError ? "alert" : "status"}
          >
            {message}
          </div>
        )}
        {profileError && (
          <p className="mt-4 leading-relaxed text-[var(--danger)]" role="alert">
            {profileError}
          </p>
        )}
        <p className="mt-6 flex items-center gap-2 text-[0.84rem] text-[var(--quiet)]">
          <LockKeyhole aria-hidden="true" size={15} /> Un espace privé, réservé
          aux participants invités.
        </p>
      </div>
      <figure className="relative isolate m-0 min-h-[570px] overflow-hidden rounded-[1.6rem] bg-[#78939c] shadow-[var(--shadow)] max-[760px]:min-h-[330px] max-[760px]:row-start-1">
        <img
          className="absolute inset-0 -z-10 h-full w-full animate-[photo-arrive_1.2s_cubic-bezier(0.2,0.8,0.2,1)_both] object-cover object-center"
          src={heroPhoto}
          alt=""
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(8_20_18/1%)_30%,rgb(8_20_18/72%)_100%)]" />
        <figcaption className="absolute inset-x-8 bottom-8 grid gap-3 text-white">
          <span className="text-[0.72rem] font-bold tracking-[0.15em]">
            LES 3 VALLÉES · ALPES FRANÇAISES
          </span>
          <span className="text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.045em]">
            Là où l’hiver prend vie.
          </span>
          <a
            className="text-[0.76rem] text-white/80 underline-offset-4 hover:underline"
            href="https://unsplash.com/photos/a-ski-lift-going-up-a-snowy-mountain-F_DifgQCPDc"
            target="_blank"
            rel="noreferrer"
          >
            Photo de Karel Mistrík · Unsplash
          </a>
        </figcaption>
        <span
          className="absolute right-7 top-7 flex items-center gap-3 text-[0.8rem] font-bold text-white"
          aria-hidden="true"
        >
          01 <span className="h-px w-14 bg-white/70" /> 03
        </span>
      </figure>
    </section>
  );
}
