import { anthropic } from "./anthropic";

export type ExtractedExpense = {
  is_expense: boolean;
  provider: string | null;
  concept: string | null;
  amount: number | null;
  currency: "ARS" | "USD" | null;
  due_date: string | null;
  period_month: string | null; // YYYY-MM del periodo cubierto (solo para resúmenes de tarjeta)
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

Confidence: 0-100 según qué tan seguro estás de la extracción.

RESÚMENES DE TARJETA DE CRÉDITO — reglas críticas:

A. CUÁL ES EL MONTO CORRECTO (muy importante — no confundir):

El monto del resumen a pagar es el "Saldo Actual", "Saldo Total", "Total a pagar" o "Nuevo saldo" — NO confundir con:
- "Total Consumos": es solo la suma de COMPRAS NUEVAS del periodo, sin contar pagos previos ni saldos.
- Cuotas individuales (ej "$99.750,00 cuota 9/12"): son consumos puntuales, no el total.
- "Saldo Anterior": lo que debías el mes pasado.
- "Cuotas a vencer": proyección futura, no el monto del mes.

Buscá en el resumen EXACTAMENTE estos conceptos (en orden de prioridad):
1. "Saldo Actual" / "Saldo Total" / "Nuevo saldo" → ESE es el amount
2. "Total a pagar" / "Importe a pagar"
3. "Pago Mínimo" (solo como última opción, si no hay otro total)

B. SALDO ACREEDOR / NEGATIVO:
Si el Saldo Actual es NEGATIVO (con signo −) o el resumen dice "saldo acreedor" / "saldo a favor" / "Pago Mínimo: $0,00" → el usuario NO tiene que pagar nada este mes.
En ese caso: **is_expense=false** con reason="saldo acreedor, no corresponde pago este mes".

C. PERIOD_MONTH:
period_month = mes de la **FECHA DE VENCIMIENTO** (cuando el usuario paga). NO el mes del consumo ni el nombre del resumen.
- Ej: venc. 2-feb-2026 → period_month="2026-02".
- Ej: venc. 1-abr-2026 → period_month="2026-04".

D. CONCEPT:
Incluí el banco + tarjeta + periodo legible para referencia ("Resumen Macro Visa Signature - venc. 01/04/2026").
5. \`due_date\` sigue siendo la fecha límite de pago impresa en el resumen (NO confundir con periodo)

Para NO-tarjetas (facturas luz, expensas, compras, suscripciones) → \`period_month: null\`.`;

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
      "period_month",
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
      concept: {
        type: ["string", "null"],
        description:
          "Descripción corta. Para resúmenes de tarjeta incluir el periodo (ej 'Resumen Visa - Febrero 2026')",
      },
      amount: { type: ["number", "null"], description: "Monto en unidades (no centavos)" },
      currency: { type: ["string", "null"], enum: ["ARS", "USD", null] },
      due_date: {
        type: ["string", "null"],
        description: "YYYY-MM-DD. Fecha límite de pago (NO es el periodo). Null si no hay.",
      },
      period_month: {
        type: ["string", "null"],
        description:
          "YYYY-MM del periodo cubierto, SOLO para resúmenes de tarjeta. null para facturas normales.",
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
  period_month: string | null;
  reason: string | null;
};

const MANUAL_SYSTEM_PROMPT = `Sos un parser de gastos personales. El usuario te escribe en español (Argentina) en lenguaje natural y tu tarea es extraer estructura.

DETECTÁS LA INTENCIÓN (regla crítica):

POR DEFECTO todo gasto nuevo es intent="future" (a pagar / en revisión). SOLO marcás intent="past" si hay EVIDENCIA EXPLÍCITA de que ya fue pagado.

Evidencia de past (cualquiera alcanza):
1. El usuario en caption/texto usa un verbo PASADO: "gasté", "compré", "pagué", "pagado", "aboné", "salió", "cancelé", "pagamos", "paid"
2. El documento muestra un stamp/sello/texto que diga "PAGADO", "CANCELADO", "PAYMENT RECEIVED", "CONFIRMACIÓN DE PAGO", "PAGO PROCESADO"
3. Es un ticket de compra física de productos (super, resto, kiosco) — esos son siempre past porque ya pagaste para llevártelo

NO es past:
- Un resumen de tarjeta (aunque venga del banco) → default future, el usuario lo paga al vencimiento
- Una factura de servicio con fecha de vencimiento → default future
- Una cuota de colegio/gym → default future
- Cualquier bill/invoice sin marca de "pagado" → future

EJEMPLOS:
- PDF "Resumen Visa Febrero 2026" subido sin caption → intent=future (a revisar y aprobar)
- PDF resumen con caption "ya pagué esto" → intent=past
- Ticket del super físico → intent=past (compras de productos)
- Texto "pagué la luz ayer" → intent=past
- Texto "tengo que pagar la luz" → intent=future
- Texto sin verbo: "factura luz $24k" → intent=future

Si dudás → intent=future (pendiente de aprobar es mejor que past erróneo).

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
- expensas: consorcio del edificio
- impuestos: ABL, patente, monotributo, IIBB
- compras: super, ropa, electro, delivery, MercadoLibre, retail
- suscrip: Netflix, Spotify, AWS, SaaS, gym adulto
- debito: retiro cajero, débito auto genérico
- familia: cuotas escolares/universidad, obra social, pediatra, cumpleaños familiares, regalos a familiares, actividades de hijos, campamentos, material escolar
- calu: gastos de la mascota Calu — veterinario, alimento mascota, accesorios, peluquería canina, guardería
- prestamo: cuotas de préstamos personales/prendarios/hipotecarios, devoluciones a amigos por dinero prestado, pagos de créditos bancarios

PERIODO MENSUAL (period_month) — regla PRINCIPAL:

El period_month representa **cuándo SALE la plata del usuario**, NO el mes del servicio NI el mes del consumo.

1. Resúmenes de tarjeta de crédito: el periodo = **mes de la FECHA DE VENCIMIENTO** (fecha en que el usuario paga).
   Ignorá el nombre del periodo del resumen ("Resumen Enero") y el rango de consumos.
   Ejemplo: Resumen con consumos 24-dic al 22-ene, vencimiento 2-feb → period_month="2026-02" (ahí paga).
   Ejemplo: Resumen con consumos febrero, vencimiento 1-abr → period_month="2026-04".
   Ejemplo: Resumen Febrero con venc. 2-mar → period_month="2026-03".

MONTO EN TARJETAS DE CRÉDITO — crítico:
El amount debe ser **"Saldo Actual"**, "Saldo Total", "Nuevo saldo" o "Total a pagar" del resumen — NO "Total Consumos" (eso son solo las compras nuevas del periodo, sin restar pagos previos).

Si Saldo Actual es NEGATIVO (signo "−") o dice "saldo acreedor" / "saldo a favor" / "Pago Mínimo $0" → **is_expense=false** (no hay nada que pagar este mes, ya pagaste de más).

2. Facturas de servicios pasados (luz, gas, agua): period_month = mes de consumo cubierto.
   Ejemplo: "Factura Edenor Marzo" emitida en abril → period_month="2026-03".

3. Facturas FORWARD-BILLED (colegio, gym, alquiler del mes entrante, suscripciones pre-pagas):
   IMPORTANTE: period_month = **mes de la FECHA DE EMISIÓN o VENCIMIENTO**, NO el mes del servicio futuro.
   Ejemplo: Cuota escolar "Marzo 2026" emitida el 19/2 → period_month="2026-02" (la plata sale en febrero).
   Ejemplo: Gym "Abril" pagado en marzo → period_month="2026-03".

4. Expensas de consorcio: period_month = mes en que se cobra (típicamente el mes actual del pago).

5. Compras puntuales (super, retail, resto): period_month=null (no hay periodo, es fecha puntual).

Rule of thumb: si dudás, period_month = mes en que el usuario efectivamente paga/pagó, no el mes al que corresponde el servicio.

- Formato YYYY-MM
- En \`concept\` incluí el periodo legible del servicio (ej "Cuota Colegio - Marzo 2026"), pero el period_month puede ser distinto.

DUE_DATE (fecha del gasto — semántica depende del intent):
- Si intent=past: la fecha EN QUE se realizó el gasto (ej: "gasté 50k ayer", "el 15 de marzo pagué...", "la semana pasada")
- Si intent=future: la fecha en que VENCE/hay que pagar
- "el 25" → si es past, 25 del mes actual o anterior según contexto; si es future, próxima ocurrencia del 25
- "ayer" / "anteayer" / "hace 3 días" → restar días a hoy
- "el viernes pasado" → último viernes. "el viernes" → próximo viernes
- "el mes pasado" / "en marzo" → usar día 15 como placeholder si no hay día específico
- Si no hay fecha mencionada → null (el sistema usa hoy para past, o queda sin vencimiento para future)
- Hoy es ${new Date().toISOString().slice(0, 10)}
- Formato siempre YYYY-MM-DD

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
      "period_month",
      "reason",
    ],
    properties: {
      is_expense: { type: "boolean" },
      provider: { type: ["string", "null"] },
      concept: { type: ["string", "null"] },
      amount: { type: ["number", "null"] },
      currency: { type: ["string", "null"], enum: ["ARS", "USD", null] },
      period_month: {
        type: ["string", "null"],
        description: "YYYY-MM del periodo — SOLO para resúmenes de tarjeta, null en otros casos",
      },
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
          "familia",
          "calu",
          "prestamo",
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
    ? `El usuario agrega: "${userCaption}". Extraé el gasto del archivo. Aplicá la regla de intent del system prompt — default future salvo que el texto o el doc indiquen pago efectuado.`
    : 'Analizá este archivo y extraé el gasto. Seguí la regla de intent del system prompt: default future (a pagar), solo intent=past si hay marca explícita de pago en el documento o si es un ticket de compra física (super/resto/retail).';

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
