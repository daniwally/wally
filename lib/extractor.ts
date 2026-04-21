import { anthropic } from "./anthropic";

export type ExtractedExpense = {
  is_expense: boolean;
  provider: string | null;
  concept: string | null;
  amount: number | null;
  currency: "ARS" | "USD" | null;
  due_date: string | null;
  category: "servicios" | "tarjeta" | "expensas" | "impuestos" | "compras" | "suscrip" | "debito" | null;
  confidence: number;
  reason: string | null;
};

const SYSTEM_PROMPT = `Sos un extractor de gastos para una app argentina de finanzas personales.

Recibís el contenido de un email (remitente, asunto, cuerpo). Decidís si es una factura/resumen/cobro que el usuario debe pagar o ya pagó.

SÍ son gastos:
- Facturas de servicios (luz, gas, agua, internet, cable)
- Resúmenes de tarjeta de crédito con saldo a pagar
- Expensas de consorcio
- Impuestos (ABL, patente, monotributo, IIBB)
- Confirmaciones de compra online (MercadoLibre, Amazon, etc)
- Suscripciones recurrentes (Netflix, Spotify, Claude Pro, AWS, etc)
- Débitos automáticos confirmados

NO son gastos:
- Newsletters, promociones, marketing
- Mails personales, chats, notificaciones sociales
- Confirmaciones de envío sin monto
- Códigos 2FA, resets de password
- Mails de GitHub/Linear/Slack sin monto real cobrado

Categorías disponibles:
- servicios (luz, gas, agua, internet, cable, celular)
- tarjeta (resúmenes Visa/Master/Amex)
- expensas (consorcio del edificio)
- impuestos (ABL, patente, monotributo, ingresos brutos)
- compras (MercadoLibre, Amazon, retail)
- suscrip (Netflix, Spotify, AWS, SaaS)
- debito (debitos autos de banco)

Currency: ARS si está en pesos (buscar "$", "pesos", "ARS", "$AR"). USD si está en dólares (buscar "US$", "USD", "u$s", "u$d", "dolares").

Due date: formato YYYY-MM-DD. Si no hay vencimiento explícito pero es un gasto ya pagado, usar la fecha del mail.

Amount: en unidades (no centavos). Ej: 24580 significa $24.580 ARS o US$24.580 según currency. Preservar decimales si vienen (ej 42.80).

Confidence: 0-100 según qué tan seguro estás de la extracción.`;

const TOOL_DEFINITION = {
  name: "record_expense",
  description:
    "Registrar el resultado del análisis del mail. Siempre llamar este tool una vez por mail.",
  input_schema: {
    type: "object" as const,
    required: [
      "is_expense",
      "provider",
      "concept",
      "amount",
      "currency",
      "due_date",
      "category",
      "confidence",
      "reason",
    ],
    properties: {
      is_expense: {
        type: "boolean",
        description: "true si el mail es una factura/cobro/compra real. false si no.",
      },
      provider: { type: ["string", "null"], description: "Nombre de la empresa/proveedor" },
      concept: { type: ["string", "null"], description: "Descripción corta del gasto" },
      amount: { type: ["number", "null"], description: "Monto en unidades (no centavos)" },
      currency: { type: ["string", "null"], enum: ["ARS", "USD", null] },
      due_date: {
        type: ["string", "null"],
        description: "YYYY-MM-DD. Null si no hay fecha clara.",
      },
      category: {
        type: ["string", "null"],
        enum: ["servicios", "tarjeta", "expensas", "impuestos", "compras", "suscrip", "debito", null],
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Confianza 0-100 en la extracción completa",
      },
      reason: {
        type: ["string", "null"],
        description: "Una línea explicando por qué sí o no es gasto",
      },
    },
  },
};

export type ManualExtracted = {
  is_expense: boolean;
  provider: string | null;
  concept: string | null;
  amount: number | null;
  currency: "ARS" | "USD" | null;
  category:
    | "servicios"
    | "tarjeta"
    | "expensas"
    | "impuestos"
    | "compras"
    | "suscrip"
    | "debito"
    | null;
  intent: "past" | "future";
  due_date: string | null;
  reason: string | null;
};

const MANUAL_SYSTEM_PROMPT = `Sos un parser de gastos personales. El usuario te escribe en español (Argentina) en lenguaje natural y tu tarea es extraer estructura.

DETECTÁS LA INTENCIÓN:
- "past": ya lo gastó (ej: "gasté", "compré", "pagué", "salió")
- "future": es un gasto pendiente/recordatorio (ej: "tengo que pagar", "me toca", "vence", "recordame")

AMOUNTS:
- "50 lucas" = 50000 ARS
- "50k" = 50000 ARS
- "120 palos" = 120000000 ARS (1 palo = 1M)
- "120.000" = 120000 ARS
- "USD 40" / "u$s 40" / "40 dólares" = 40 USD
- Si no hay moneda explícita → ARS

CATEGORÍAS:
- servicios: luz, gas, agua, internet, celular, cable
- tarjeta: resúmenes Visa/Master/Amex
- expensas: consorcio
- impuestos: ABL, patente, monotributo, IIBB
- compras: super, ropa, electro, delivery single, MercadoLibre
- suscrip: Netflix, Spotify, AWS, SaaS, gym
- debito: retiro cajero, débito auto

DUE_DATE:
- "el 25" con mes actual → próxima ocurrencia del día 25
- "mañana" → fecha mañana
- "el viernes" → próximo viernes
- Hoy es ${new Date().toISOString().slice(0, 10)}

Si no podés parsear razonablemente, is_expense: false con reason explicando qué falta.`;

const MANUAL_TOOL_DEFINITION = {
  name: "record_manual_expense",
  description: "Registrar un gasto desde texto libre del usuario. Siempre llamar este tool.",
  input_schema: {
    type: "object" as const,
    required: [
      "is_expense",
      "provider",
      "concept",
      "amount",
      "currency",
      "category",
      "intent",
      "due_date",
      "reason",
    ],
    properties: {
      is_expense: { type: "boolean" },
      provider: { type: ["string", "null"] },
      concept: { type: ["string", "null"] },
      amount: { type: ["number", "null"] },
      currency: { type: ["string", "null"], enum: ["ARS", "USD", null] },
      category: {
        type: ["string", "null"],
        enum: [
          "servicios",
          "tarjeta",
          "expensas",
          "impuestos",
          "compras",
          "suscrip",
          "debito",
          null,
        ],
      },
      intent: { type: "string", enum: ["past", "future"] },
      due_date: { type: ["string", "null"] },
      reason: { type: ["string", "null"] },
    },
  },
};

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function extractAttachmentExpense(
  attachment:
    | {
        type: "image";
        source: { type: "base64"; media_type: ImageMediaType; data: string };
      }
    | {
        type: "document";
        source: { type: "base64"; media_type: "application/pdf"; data: string };
      },
  userCaption?: string,
): Promise<ManualExtracted> {
  const instruction = userCaption
    ? `El usuario agrega: "${userCaption}". Extraé el gasto del archivo adjunto.`
    : "Analizá este comprobante/factura/ticket/resumen/recibo y extraé el gasto que muestra.";

  const response = await anthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: [
      { type: "text", text: MANUAL_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    tools: [MANUAL_TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "record_manual_expense" },
    messages: [
      {
        role: "user",
        content: [attachment, { type: "text", text: instruction }],
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call record_manual_expense");
  }
  return toolUse.input as ManualExtracted;
}

export async function extractManualExpense(text: string): Promise<ManualExtracted> {
  const response = await anthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: [
      { type: "text", text: MANUAL_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    tools: [MANUAL_TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "record_manual_expense" },
    messages: [{ role: "user", content: text }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call record_manual_expense");
  }
  return toolUse.input as ManualExtracted;
}

export async function extractExpense(mail: {
  from: string;
  subject: string;
  body: string;
  received_at: string;
}): Promise<ExtractedExpense> {
  const truncatedBody = mail.body.slice(0, 8000);

  const response = await anthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "record_expense" },
    messages: [
      {
        role: "user",
        content: `From: ${mail.from}
Subject: ${mail.subject}
Received: ${mail.received_at}

Body:
${truncatedBody}`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call record_expense");
  }

  return toolUse.input as ExtractedExpense;
}
