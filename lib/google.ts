import { google, type gmail_v1 } from "googleapis";

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export function googleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
  if (!clientSecret) throw new Error("GOOGLE_CLIENT_SECRET is not set");

  return new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/auth/google/callback`);
}

export function buildAuthUrl(state: string) {
  return googleOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCode(code: string) {
  const oauth = googleOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh_token returned — user must re-consent");
  }
  return tokens;
}

export async function fetchUserEmail(accessToken: string) {
  const oauth = googleOAuthClient();
  oauth.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: oauth });
  const { data } = await oauth2.userinfo.get();
  return data.email ?? null;
}

export function gmailClient(refreshToken: string) {
  const oauth = googleOAuthClient();
  oauth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth });
}

export type RawMail = {
  id: string;
  from: string;
  subject: string;
  body: string;
  received_at: string;
};

const FINANCE_KEYWORDS = [
  // Documentos/conceptos
  "factura",
  "resumen",
  "vencimiento",
  "saldo",
  "recibo",
  "boleta",
  "comprobante",
  "invoice",
  "receipt",
  "subscription",
  "\"total a pagar\"",
  // Verbos en presente/infinitivo
  "pago",
  "pagar",
  "cobro",
  "debito",
  "débito",
  "renovacion",
  "renovación",
  "suscripcion",
  "suscripción",
  // Verbos en pasado (para self-mails y confirmaciones)
  "pagué",
  "pague",
  "pagado",
  "gasté",
  "gaste",
  "compré",
  "compre",
  "aboné",
  "abone",
  "abonado",
  "transferí",
  "transferi",
  "cobré",
  "cobre",
  "cancelé",
  "cancele",
  "payment",
  "paid",
];

export async function fetchGeneralInbox(
  refreshToken: string,
  sinceUnixSec: number,
  maxResults = 25,
): Promise<RawMail[]> {
  const gmail = gmailClient(refreshToken);

  const sinceDate = new Date(sinceUnixSec * 1000);
  const y = sinceDate.getUTCFullYear();
  const m = String(sinceDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(sinceDate.getUTCDate()).padStart(2, "0");

  const keywordClause = `(${FINANCE_KEYWORDS.join(" OR ")})`;
  const query = `${keywordClause} after:${y}/${m}/${d} -in:spam -in:trash`;

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const ids = list.data.messages?.map((m) => m.id!) ?? [];

  const mails = await Promise.all(
    ids.map(async (id) => {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });
      return parseMessage(msg.data);
    }),
  );

  return mails.filter((m): m is RawMail => m !== null);
}

export async function fetchMailsBySender(
  refreshToken: string,
  senderPattern: string,
  sinceUnixSec: number,
  maxResults = 30,
): Promise<RawMail[]> {
  const gmail = gmailClient(refreshToken);

  const sinceDate = new Date(sinceUnixSec * 1000);
  const y = sinceDate.getUTCFullYear();
  const m = String(sinceDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(sinceDate.getUTCDate()).padStart(2, "0");

  const query = `from:${senderPattern} after:${y}/${m}/${d} -in:spam -in:trash`;

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const ids = list.data.messages?.map((m) => m.id!) ?? [];

  const mails = await Promise.all(
    ids.map(async (id) => {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });
      return parseMessage(msg.data);
    }),
  );

  return mails.filter((m): m is RawMail => m !== null);
}

function parseMessage(msg: gmail_v1.Schema$Message): RawMail | null {
  if (!msg.id || !msg.payload) return null;

  const headers = msg.payload.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const from = getHeader("from");
  const subject = getHeader("subject");
  const date = getHeader("date");

  const body = extractBody(msg.payload);

  return {
    id: msg.id,
    from,
    subject,
    body,
    received_at: date || new Date(Number(msg.internalDate ?? 0)).toISOString(),
  };
}

function extractBody(part: gmail_v1.Schema$MessagePart): string {
  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }
  const parts = part.parts ?? [];
  const textPart = parts.find((p) => p.mimeType === "text/plain");
  if (textPart) return extractBody(textPart);
  const htmlPart = parts.find((p) => p.mimeType === "text/html");
  if (htmlPart) return stripHtml(extractBody(htmlPart));
  for (const p of parts) {
    const nested = extractBody(p);
    if (nested) return nested;
  }
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
