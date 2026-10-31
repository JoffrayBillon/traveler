import { ArrowRight, LockKeyhole, MountainSnow } from "lucide-react";
import {
  Button,
  Form,
  Input,
  Label,
  Text,
  TextField,
} from "react-aria-components";

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
    <section className="signin-page" aria-labelledby="welcome-title">
      <div className="signin-content">
        <p className="eyebrow signin-eyebrow">
          <MountainSnow aria-hidden="true" size={16} />
          LE VOYAGE COMMENCE ICI
        </p>
        <h1 id="welcome-title">
          La montagne
          <br />
          vous appelle<span>.</span>
        </h1>
        <p className="signin-intro">
          Votre séjour, vos billets, votre chambre. Tout ce qu’il faut pour
          partir l’esprit libre.
        </p>
        <Form className="signin-form" onSubmit={onSubmit}>
          <TextField
            type="email"
            value={email}
            onChange={onEmailChange}
            isRequired
            autoComplete="email"
          >
            <Label>Votre adresse e-mail</Label>
            <Input
              placeholder="vous@exemple.fr"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <Text slot="description">
              Utilisez l’adresse communiquée à l’organisation.
            </Text>
          </TextField>
          <Button
            className="signin-submit"
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
            className={`signin-message${hasError ? " is-error" : ""}`}
            role={hasError ? "alert" : "status"}
          >
            {message}
          </div>
        )}
        {profileError && (
          <p className="signin-message is-error" role="alert">
            {profileError}
          </p>
        )}
        <p className="signin-privacy">
          <LockKeyhole aria-hidden="true" size={15} /> Un espace privé, réservé
          aux participants invités.
        </p>
      </div>
      <figure className="signin-visual">
        <img src={heroPhoto} alt="" fetchPriority="high" decoding="async" />
        <div className="signin-visual-overlay" />
        <figcaption>
          <span className="visual-kicker">
            LES 3 VALLÉES · ALPES FRANÇAISES
          </span>
          <span className="visual-title">Là où l’hiver prend vie.</span>
          <a
            className="photo-credit"
            href="https://unsplash.com/photos/a-ski-lift-going-up-a-snowy-mountain-F_DifgQCPDc"
            target="_blank"
            rel="noreferrer"
          >
            Photo de Karel Mistrík · Unsplash
          </a>
        </figcaption>
        <span className="visual-index" aria-hidden="true">
          01 <span /> 03
        </span>
      </figure>
    </section>
  );
}
