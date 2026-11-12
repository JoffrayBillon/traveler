export type MagicLinkSender = (
  email: string,
  url: string,
  metadata?: Record<string, unknown>,
) => Promise<void>;
