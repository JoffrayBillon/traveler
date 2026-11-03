import { del, get, put } from "@vercel/blob";
import type { TicketBlobStorage } from "../../ports/ticket-storage";

export const vercelTicketStorage: TicketBlobStorage = { put, get, del };
