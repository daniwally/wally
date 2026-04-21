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
