import { Brevo, BrevoClient, BrevoError } from "@getbrevo/brevo";
import type { MagicLinkSender } from "../../ports/email-sender";

export function createBrevoMagicLinkSender(
  apiKey: string,
  senderEmail: string,
): MagicLinkSender {
  return async (email, url) => {
    const safeUrl = escapeHtml(url);
    const client = new BrevoClient({
      apiKey,
      maxRetries: 1,
      timeoutInSeconds: 10,
    });

    try {
      await client.transactionalEmails.sendTransacEmail({
        sender: { name: "BotMail", email: senderEmail },
        to: [{ email }],
        subject: "Votre lien de connexion Traveler",
        textContent: `Connectez-vous à votre espace Traveler : ${url}\n\nCe lien expire après 10 minutes et ne peut être utilisé qu’une fois.`,
        htmlContent: `<p>Connectez-vous à votre espace Traveler.</p><p><a href="${safeUrl}">Ouvrir mon espace voyage</a></p><p>Ce lien expire après 10 minutes et ne peut être utilisé qu’une fois.</p>`,
      });
    } catch (error) {
      if (error instanceof Brevo.UnauthorizedError) {
        throw new Error("Brevo rejected the API key.");
      }
      if (error instanceof Brevo.ForbiddenError) {
        throw new Error("Brevo rejected the sender or API permission.");
      }
      if (error instanceof BrevoError) {
        throw new Error(
          `Brevo email API responded with HTTP ${error.statusCode}.`,
        );
      }
      throw error;
    }
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}
