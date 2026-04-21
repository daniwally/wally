import { anthropic } from "./anthropic";
import { extractPdfText, moonshotToolCall, hasMoonshot } from "./moonshot";
import { supabase, WALLY_USER_ID } from "./supabase";

export type ExtractedExpense = {
  is_expense: boolean;
  provider: string | null;
  concept: string | null;
  amount: number | null;
  currency: "ARS" | "USD" | null;
  due_date: string | null;
  period_month: string | null; // YYYY-MM del periodo cubierto (solo para resúmenes de tarjeta)
  category: "servicios" | "tarjeta" | "expensas" | "impuestos" | "compras" | "suscrip" | "debito" | "familia" | "calu" | "prestamo" | null;
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
- prestamo (cuotas préstamo, crédito bancario, mutuo — SIEMPRE preferir sobre debito si aparece la palabra "préstamo", "credito", "mutuo")
- debito (SOLO retiros cajero, transferencias genéricas — NO para préstamos)
- familia (cuota colegio/universidad, obra social, pediatra, cumpleaños, regalos a familiares)
- calu (mascota: veterinario, alimento, peluquería canina, guardería)

Currency: ARS si está en pesos (buscar "$", "pesos", "ARS", "$AR"). USD si está en dólares (buscar "US$", "USD", "u$s", "u$d", "dolares").

Due date: formato YYYY-MM-DD. Si no hay vencimiento explícito pero es un gasto ya pagado, usar la fecha del mail.

Amount: en unidades (no centavos). Ej: 24580 significa $24.580 ARS o US$24.580 según currency. Preservar decimales si vienen (ej 42.80).

Confidence: 0-100 según qué tan seguro estás de la extracción.

RESÚMENES DE TARJETA DE CRÉDITO — reglas críticas:

A0. PERIOD_MONTH = MES DE CIERRE (último mes del ciclo de consumos):
El period_month es el mes en que **termina el ciclo de consumos** del resumen. NO el mes del vencimiento, NO el mes del nombre del resumen si no coincide.

Ejemplos:
- Consumos "24-dic-25 al 22-ene-26" → cierra en enero → period_month="2026-01"
- Consumos "22-ene al 19-feb-26" → cierra en febrero → period_month="2026-02"
- Concept dice "Resumen Enero 2026" y cycle dic-ene → period_month="2026-01"
- Concept dice "Febrero 2026" → period_month="2026-02" (salvo evidencia contraria en el ciclo)
- Si el resumen abarca 2 meses (ej "febrero-marzo"), usar el mes de cierre (el segundo).

Esto hace que:
- El resumen de enero (cuyos consumos cierran en enero, se paga en feb) aparezca en ENERO del dashboard.
- El resumen de febrero en FEBRERO, etc.
- El mes del vencimiento queda registrado en due_date pero NO domina period_month.

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

C. PERIOD_MONTH (ver sección A0 arriba):
period_month = mes de CIERRE del ciclo de consumos. NO el mes del vencimiento.

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
        enum: ["servicios", "tarjeta", "expensas", "impuestos", "compras", "suscrip", "debito", "familia", "calu", "prestamo", null],
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
- prestamo: cuotas de préstamos personales/prendarios/hipotecarios, devoluciones a amigos por dinero prestado, pagos de créditos bancarios. PALABRAS CLAVE: "préstamo", "prestamo", "cuota préstamo", "crédito bancario", "credito", "mutuo". SIEMPRE preferir esta sobre "debito" cuando aparezca alguna de estas palabras.
- debito: SOLO para retiros de cajero, transferencias genéricas o débitos automáticos que no caigan en otra categoría. NO usar para préstamos.
- familia: cuotas escolares/universidad, obra social, pediatra, cumpleaños familiares, regalos a familiares, actividades de hijos, campamentos, material escolar
- calu: gastos de la mascota Calu — veterinario, alimento mascota, accesorios, peluquería canina, guardería

PERIODO MENSUAL (period_month) — regla PRINCIPAL:

El period_month representa **cuándo SALE la plata del usuario**, NO el mes del servicio NI el mes del consumo.

1. Resúmenes de tarjeta de crédito: el periodo = **mes en que CIERRA el ciclo de consumos** (cuando termina el periodo del resumen).
   Ejemplo: Resumen con consumos 24-dic al 22-ene, cierre 22-ene → period_month="2026-01" (cierra en enero).
   Ejemplo: Resumen con consumos 22-ene al 19-feb → period_month="2026-02".
   Ejemplo: Resumen "Febrero 2026" ciclo feb → period_month="2026-02".
   Si el resumen abarca 2 meses (ej "febrero-marzo"), usar el mes de cierre (el segundo).

MONTO EN TARJETAS DE CRÉDITO — crítico:
El amount debe ser **"Saldo Actual"**, "Saldo Total", "Nuevo saldo" o "Total a pagar" del resumen — NO "Total Consumos" (eso son solo las compras nuevas del periodo, sin restar pagos previos).

Si Saldo Actual es NEGATIVO (signo "−") o dice "saldo acreedor" / "saldo a favor" / "Pago Mínimo $0" → **is_expense=false** (no hay nada que pagar este mes, ya pagaste de más).

Concept sugerido: "Resumen [Banco] [Tarjeta] - [Mes del cierre] 2026" (ej "Resumen Galicia Visa - Enero 2026").

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

// ─────────────────────────────────────────────────────────────────
// Line-item extraction de resúmenes de tarjeta
// ─────────────────────────────────────────────────────────────────

// Tipos de comercio granulares, inspirados en Mint/YNAB/Personal Capital
// adaptados a Argentina (supermercado, combustible, delivery, etc.)
export type MerchantType =
  | "supermercado"
  | "restaurante"
  | "cafeteria"
  | "delivery_comida"
  | "kiosco_almacen"
  | "combustible"
  | "transporte"
  | "peaje"
  | "estacionamiento"
  | "farmacia"
  | "salud"
  | "educacion"
  | "indumentaria"
  | "electronica"
  | "retail"
  | "marketplace"
  | "hogar_muebles"
  | "ferreteria"
  | "streaming"
  | "saas"
  | "gaming"
  | "entretenimiento"
  | "viajes_aereos"
  | "hoteles"
  | "turismo_local"
  | "belleza"
  | "gimnasio"
  | "mascota"
  | "servicios_publicos"
  | "telecomunicaciones"
  | "seguro"
  | "impuesto"
  | "banco_comisiones"
  | "prestamo_cuota"
  | "regalo"
  | "donacion"
  | "profesional_servicios"
  | "otros";

export type StatementItem = {
  merchant: string;
  merchant_raw: string | null;
  amount: number;
  currency: "ARS" | "USD";
  purchase_date: string | null;
  cuota_numero: number | null;
  cuota_total: number | null;
  category: CategoriaKeyStr | null;
  merchant_type: MerchantType | null;
  is_essential: boolean | null;
};

type CategoriaKeyStr =
  | "servicios"
  | "tarjeta"
  | "expensas"
  | "impuestos"
  | "compras"
  | "suscrip"
  | "debito"
  | "familia"
  | "calu"
  | "prestamo";

const STATEMENT_ITEMS_SYSTEM = `Sos un extractor de consumos individuales de resúmenes de tarjeta de crédito argentinos.

Recibís un resumen (PDF o imagen) y extraés CADA CONSUMO como un item separado.

INCLUIR:
- Cada compra individual con comercio, fecha, monto
- Cuotas: si dice "C.09/12" o "04/06" en columna cuota, extraé cuota_numero=9 (o 4), cuota_total=12 (o 6)
- Consumos en ARS y USD (como items separados — un consumo USD 19.99 es currency=USD, amount=19.99)
- Los consumos pueden aparecer en múltiples secciones tipo "Tarjeta XXXX Total Consumos de..."
  Ignorá las líneas de "Total Consumos" pero SÍ incluí cada detalle individual anterior
- Apple/App Store purchases (cada línea APPLE.COM/BILL es un consumo separado, suelen ser USD)

NO INCLUIR (filtrá estas líneas):
- "SU PAGO EN PESOS" / "SU PAGO EN DOLARES" (pagos que hiciste, no consumos)
- "SALDO ANTERIOR"
- "TRANSFERENCIA DEUDA" (transferencia de saldo)
- "INTERESES FINANCIACION" / "Intereses por financiación"
- "DB IVA" / "IVA RESP.INSCR" (IVA sobre intereses)
- "PERCEP.IVA" / percepción IVA RG 2408
- "IIBB PERCEP" / Ingresos Brutos percepción
- "DB.RG 5617" / Percepción AFIP (impuesto PAIS, cripto, etc)
- "Ley 25.065"
- Seguros del banco (vida, robo, integral)
- Comisiones bancarias (renovación, mantenimiento)
- Cargos por reposición de tarjeta, adelanto efectivo
- Redondeos / ajustes
- Líneas "Total Consumos de DANIEL..." (son subtotales)
- "TOTAL A PAGAR" (es el total final)

NORMALIZACIÓN DE MERCHANT (patrones argentinos comunes):
Prefijos/procesadores a quitar:
- "=DLO" o "DLO" → delivery/procesadora (sacalo). Ej "=DLORAPPI" → "Rappi"
- "MERPAGO*X" o "MERPAGO X" → X vía MercadoPago. Ej "MERPAGO*BEDTIME" → "Bedtime"
- "PAYU*X" o "PAYU-X" → X vía PayU. Ej "PAYU-NETFLIX" → "Netflix"
- "DLOCAL*X" → X vía dLocal
- "AMX*X" → X vía American Express gateway
- "SPS*X" → X (procesador)
- Códigos numéricos prefix (ej "25 349704 *") — ignorar
- Sufijos de tipo "/BILL", ".COM", "/SERVICES" — simplificar al nombre principal

Ejemplos de normalización:
- "=DLORAPPI" → "Rappi" (merchant_type: delivery_comida)
- "MERPAGO*MERCADOLIBRE" → "MercadoLibre" (marketplace)
- "APPLE.COM/BILL" → "Apple" (saas o gaming según contexto, default saas)
- "PAYU-NETFLIX 626858" → "Netflix" (streaming)
- "NETFLIX.COM" → "Netflix" (streaming)
- "AIRBNB * HMTA5JEZN9" → "Airbnb" (hoteles)
- "AMAZON WEB SERVICES" → "AWS" (saas)
- "=DLORAPPI" dentro de tarjeta AMEX → "Rappi" (delivery_comida)
- "ORGANIZZA" → "Organizza" (restaurante si es conocido)
- "RONDA-PAOLO FOCACCERIA" → "Paolo Focacceria" (restaurante)
- "MERPAGO*GOOMNUTRITION" → "Goomnutrition" (otros)
- "MERPAGO*FERREJASPER" → "Ferrejasper" (ferreteria)
- "MERPAGO*CASAGISELA" → "Casa Gisela" (retail)
- "MERPAGO*EXITODISENOD" → "Exito Diseño" (retail)
- "COTO C 8025" → "Coto" (supermercado)
- "FARMACITY 302" → "Farmacity" (farmacia)
- "YPF SUC 1234" → "YPF" (combustible)

Usá mayúscula inicial. Si el merchant es claramente una cadena conocida, usá el nombre popular (Netflix, Apple, Rappi, Coto, YPF, etc.).

CATEGORY (broad): servicios, tarjeta, expensas, impuestos, compras, suscrip, debito, familia, calu, prestamo.

MERCHANT_TYPE (granular — siempre completalo, usá el más específico):
- supermercado: Coto, Carrefour, Jumbo, Disco, Dia, La Anónima, Vea, ChangoMás, Cooperativa
- restaurante: restaurantes, parrillas, pizzerías, McDonalds/BurgerKing/otros FF si es en local
- cafeteria: Starbucks, Havanna, cafeterías, panaderías
- delivery_comida: Rappi, PedidosYa, GlovoFoods (apps de delivery)
- kiosco_almacen: kioscos, chinos, mini-mercados
- combustible: YPF, Shell, Axion, Puma, Petrobras, gas stations
- transporte: Uber, Cabify, Didi, Remises, taxis, trenes, subte (SUBE)
- peaje: Pago Fácil peajes, Telepase, peajes autopistas
- estacionamiento: cocheras, parking
- farmacia: Farmacity, Dr Ahorro, Farmapunto, cualquier farmacia
- salud: consultas médicas, obra social, clínicas, lab análisis, dentista
- educacion: colegios, universidades, cursos, libros educativos
- indumentaria: ropa, zapatos, accesorios (Adidas, Zara, Cheeky, etc.)
- electronica: Frávega, Garbarino, Apple, electro (Samsung, Noblex)
- retail: tiendas genéricas, grandes tiendas, liquidaciones
- marketplace: MercadoLibre, Amazon, Shopee, Tiendanube
- hogar_muebles: Easy, Sodimac, muebles, decoración, Falabella
- ferreteria: ferreterías, materiales construcción
- streaming: Netflix, Spotify, Disney+, HBO, Crunchyroll, YouTube Premium
- saas: AWS, Claude Pro, Figma, Notion, Adobe, Cursor, Lovable
- gaming: Steam, PlayStation, Xbox, consolas
- entretenimiento: cines, teatros, shows, eventos, juegos
- viajes_aereos: aerolíneas, Despegar vuelos, Kiwi, airline reservations
- hoteles: hoteles, Airbnb, Booking, Despegar hoteles
- turismo_local: paseos, excursiones, alquiler autos turismo
- belleza: peluquería, manicura, cosmética, spa, estética
- gimnasio: gyms, SportsClub, crossfit, yoga studios
- mascota: veterinarios, petshops, guardería canina
- servicios_publicos: Edenor, Edesur, Metrogas, AySA, Cablevisión, internet, luz/gas/agua
- telecomunicaciones: Personal, Claro, Movistar, Fibertel (celular/internet)
- seguro: seguros auto/hogar/vida
- impuesto: ABL, patente, monotributo, IIBB, Rentas
- banco_comisiones: comisiones bancarias, mantenimiento, interbank
- prestamo_cuota: cuotas de préstamos, Mutual, créditos
- regalo: regalerías, flores, regalos identificables
- donacion: ONGs, iglesias, donaciones
- profesional_servicios: abogados, contadores, consultores, profesionales
- otros: cuando no matchea ninguna

IS_ESSENTIAL (true/false):
- true (esencial): supermercado, servicios_publicos, telecomunicaciones, salud, farmacia, transporte, combustible, educacion, hogar_muebles, seguro, impuesto, prestamo_cuota, ferreteria
- false (discrecional): restaurante, cafeteria, delivery_comida, streaming, gaming, entretenimiento, viajes, hoteles, belleza, gimnasio, indumentaria, regalo, donacion, marketplace (salvo que sea obvio esencial)
- En dudas → false (discrecional)

CATEGORY (broad, ya existente) sugerida por merchant:
- Netflix/Spotify/Disney/HBO/AWS/SaaS → suscrip
- Mercadolibre/Amazon/retail/marketplaces → compras
- Supermercados/restaurantes/delivery → compras
- Pagomiscuentas/expensas → expensas
- Vet/petshop → calu
- Colegios/universidad → familia
- Sin inferencia clara → null

FORMATO:
Llamá al tool record_items con un array. Ejemplo:
[
  {
    "merchant": "Coto",
    "merchant_raw": "COTO*MARKET MAR 45",
    "amount": 45320,
    "currency": "ARS",
    "purchase_date": "2026-02-15",
    "cuota_numero": null,
    "cuota_total": null,
    "category": "compras",
    "merchant_type": "supermercado",
    "is_essential": true
  },
  {
    "merchant": "Netflix",
    "merchant_raw": "NETFLIX.COM",
    "amount": 11990,
    "currency": "ARS",
    "purchase_date": "2026-02-03",
    "cuota_numero": null,
    "cuota_total": null,
    "category": "suscrip",
    "merchant_type": "streaming",
    "is_essential": false
  }
]

Si el resumen no tiene consumos (ej saldo acreedor con 0 movimientos) → array vacío.`;

const ITEMS_TOOL = {
  name: "record_items",
  description: "Registrar el array de consumos extraídos. Siempre llamá este tool.",
  input_schema: {
    type: "object" as const,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: [
            "merchant",
            "merchant_raw",
            "amount",
            "currency",
            "purchase_date",
            "cuota_numero",
            "cuota_total",
            "category",
            "merchant_type",
            "is_essential",
          ],
          properties: {
            merchant: { type: "string" },
            merchant_raw: { type: ["string", "null"] },
            amount: { type: "number" },
            currency: { type: "string", enum: ["ARS", "USD"] },
            purchase_date: { type: ["string", "null"] },
            cuota_numero: { type: ["integer", "null"] },
            cuota_total: { type: ["integer", "null"] },
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
            merchant_type: {
              type: ["string", "null"],
              enum: [
                "supermercado",
                "restaurante",
                "cafeteria",
                "delivery_comida",
                "kiosco_almacen",
                "combustible",
                "transporte",
                "peaje",
                "estacionamiento",
                "farmacia",
                "salud",
                "educacion",
                "indumentaria",
                "electronica",
                "retail",
                "marketplace",
                "hogar_muebles",
                "ferreteria",
                "streaming",
                "saas",
                "gaming",
                "entretenimiento",
                "viajes_aereos",
                "hoteles",
                "turismo_local",
                "belleza",
                "gimnasio",
                "mascota",
                "servicios_publicos",
                "telecomunicaciones",
                "seguro",
                "impuesto",
                "banco_comisiones",
                "prestamo_cuota",
                "regalo",
                "donacion",
                "profesional_servicios",
                "otros",
                null,
              ],
            },
            is_essential: {
              type: ["boolean", "null"],
            },
          },
        },
      },
    },
  },
};

export type CustomMerchantType = {
  slug: string;
  label: string;
  icon: string;
  description: string | null;
  is_essential: boolean | null;
};

// Carga categorías custom del usuario
export async function loadCustomMerchantTypes(): Promise<CustomMerchantType[]> {
  const { data } = await supabase()
    .from("custom_merchant_types")
    .select("slug, label, icon, description, is_essential")
    .eq("user_id", WALLY_USER_ID);
  return (data ?? []).map((d) => ({
    slug: d.slug,
    label: d.label,
    icon: d.icon ?? "·",
    description: d.description,
    is_essential: d.is_essential,
  }));
}

const BASE_MERCHANT_TYPE_ENUM: (string | null)[] = [
  "supermercado",
  "restaurante",
  "cafeteria",
  "delivery_comida",
  "kiosco_almacen",
  "combustible",
  "transporte",
  "peaje",
  "estacionamiento",
  "farmacia",
  "salud",
  "educacion",
  "indumentaria",
  "electronica",
  "retail",
  "marketplace",
  "hogar_muebles",
  "ferreteria",
  "streaming",
  "saas",
  "gaming",
  "entretenimiento",
  "viajes_aereos",
  "hoteles",
  "turismo_local",
  "belleza",
  "gimnasio",
  "mascota",
  "servicios_publicos",
  "telecomunicaciones",
  "seguro",
  "impuesto",
  "banco_comisiones",
  "prestamo_cuota",
  "regalo",
  "donacion",
  "profesional_servicios",
  "otros",
];

function buildItemsTool(customTypes: CustomMerchantType[]) {
  const fullEnum = [...BASE_MERCHANT_TYPE_ENUM, ...customTypes.map((c) => c.slug), null];
  // Clonamos el schema y actualizamos solo el enum del merchant_type
  const schema = JSON.parse(JSON.stringify(ITEMS_TOOL.input_schema));
  schema.properties.items.items.properties.merchant_type.enum = fullEnum;
  return { ...ITEMS_TOOL, input_schema: schema };
}

function buildCustomTypesPromptSection(customTypes: CustomMerchantType[]): string {
  if (customTypes.length === 0) return "";
  return `\n\nCATEGORÍAS CUSTOM DEL USUARIO (usá estas si matchean mejor que las built-in):\n${customTypes
    .map(
      (c) =>
        `- ${c.slug}: ${c.label}${c.description ? ` — ${c.description}` : ""}${c.is_essential === true ? " (esencial)" : c.is_essential === false ? " (discrecional)" : ""}`,
    )
    .join("\n")}`;
}

// Metadata sobre merchant types (label + emoji para UI)
export const MERCHANT_TYPE_META: Record<MerchantType, { label: string; icon: string }> = {
  supermercado: { label: "Supermercado", icon: "🛒" },
  restaurante: { label: "Restaurante", icon: "🍽️" },
  cafeteria: { label: "Cafetería", icon: "☕" },
  delivery_comida: { label: "Delivery", icon: "🛵" },
  kiosco_almacen: { label: "Kiosco/Almacén", icon: "🏪" },
  combustible: { label: "Combustible", icon: "⛽" },
  transporte: { label: "Transporte", icon: "🚕" },
  peaje: { label: "Peaje", icon: "🛣️" },
  estacionamiento: { label: "Estacionamiento", icon: "🅿️" },
  farmacia: { label: "Farmacia", icon: "💊" },
  salud: { label: "Salud", icon: "🏥" },
  educacion: { label: "Educación", icon: "🎓" },
  indumentaria: { label: "Indumentaria", icon: "👕" },
  electronica: { label: "Electrónica", icon: "📱" },
  retail: { label: "Retail", icon: "🛍️" },
  marketplace: { label: "Marketplace", icon: "📦" },
  hogar_muebles: { label: "Hogar", icon: "🛋️" },
  ferreteria: { label: "Ferretería", icon: "🔧" },
  streaming: { label: "Streaming", icon: "📺" },
  saas: { label: "SaaS", icon: "💻" },
  gaming: { label: "Gaming", icon: "🎮" },
  entretenimiento: { label: "Entretenimiento", icon: "🎭" },
  viajes_aereos: { label: "Vuelos", icon: "✈️" },
  hoteles: { label: "Hoteles", icon: "🏨" },
  turismo_local: { label: "Turismo", icon: "🗺️" },
  belleza: { label: "Belleza", icon: "💄" },
  gimnasio: { label: "Gimnasio", icon: "💪" },
  mascota: { label: "Mascota", icon: "🐾" },
  servicios_publicos: { label: "Servicios", icon: "⚡" },
  telecomunicaciones: { label: "Telco", icon: "📡" },
  seguro: { label: "Seguro", icon: "🛡️" },
  impuesto: { label: "Impuesto", icon: "📋" },
  banco_comisiones: { label: "Comisiones banco", icon: "🏦" },
  prestamo_cuota: { label: "Préstamo", icon: "💵" },
  regalo: { label: "Regalo", icon: "🎁" },
  donacion: { label: "Donación", icon: "❤️" },
  profesional_servicios: { label: "Prof./Servicios", icon: "👔" },
  otros: { label: "Otros", icon: "·" },
};

// Auto-switch entre Haiku (rápido/barato) y Sonnet (preciso/caro)
// basado en tamaño del archivo como proxy de cantidad de consumos
function pickItemsModel(fileBytes?: number): {
  model: "claude-haiku-4-5-20251001" | "claude-sonnet-4-6";
  maxTokens: number;
} {
  const size = fileBytes ?? 0;
  // PDFs chicos (<250KB): típicamente 10-40 items → Haiku con 8k tokens alcanza
  // PDFs medianos (250-400KB): 40-80 items → Haiku con 16k tokens
  // PDFs grandes (>400KB) o imagen (vision siempre más exigente): Sonnet
  if (size === 0 || size > 400_000) {
    return { model: "claude-sonnet-4-6", maxTokens: 16000 };
  }
  if (size > 250_000) {
    return { model: "claude-haiku-4-5-20251001", maxTokens: 16000 };
  }
  return { model: "claude-haiku-4-5-20251001", maxTokens: 8000 };
}

// Intenta extraer con Kimi (Moonshot) — más barato ~10x vs Sonnet
// Solo funciona para PDFs (usa file-extract API, no vision)
async function tryKimi(
  pdfBuffer: Buffer,
  filename: string,
  customTypes: CustomMerchantType[],
): Promise<StatementItem[] | null> {
  if (!hasMoonshot()) return null;
  try {
    const text = await extractPdfText(pdfBuffer, filename);
    if (!text || text.length < 100) return null;

    const dynamicTool = buildItemsTool(customTypes);
    const dynamicPrompt =
      STATEMENT_ITEMS_SYSTEM + buildCustomTypesPromptSection(customTypes);

    const input = await moonshotToolCall({
      systemPrompt: dynamicPrompt,
      userContent: `Analizá este resumen de tarjeta y extraé TODOS los consumos:\n\n${text.slice(0, 100000)}`,
      tool: {
        name: "record_items",
        description: dynamicTool.description,
        input_schema: dynamicTool.input_schema,
      },
      model: "moonshot-v1-128k",
      maxTokens: 16000,
    });

    const items = (input as { items?: StatementItem[] }).items ?? [];
    return items;
  } catch (e) {
    console.error("Kimi extraction failed", e);
    return null;
  }
}

export async function extractStatementItems(
  attachment:
    | {
        type: "image";
        source: { type: "base64"; media_type: ImageMediaType; data: string };
      }
    | {
        type: "document";
        source: { type: "base64"; media_type: "application/pdf"; data: string };
      },
  fileBytes?: number,
): Promise<StatementItem[]> {
  // Estrategia multi-modelo para minimizar costo:
  // 1. Si es PDF y tenemos Moonshot → intentamos Kimi primero (más barato ~10x)
  // 2. Si Kimi falla o devuelve vacío → auto-switch Haiku/Sonnet de Claude
  // 3. Si es imagen → siempre Claude (Kimi file-extract no soporta images)

  if (attachment.type === "document" && hasMoonshot()) {
    const pdfBuffer = Buffer.from(attachment.source.data, "base64");
    const customTypes = await loadCustomMerchantTypes();
    const kimiItems = await tryKimi(pdfBuffer, "resumen.pdf", customTypes);
    if (kimiItems && kimiItems.length > 0) {
      return kimiItems;
    }
    // Si Kimi no detectó nada, cae a Claude
  }
  const { model, maxTokens } = pickItemsModel(fileBytes);

  const customTypes = await loadCustomMerchantTypes();
  const dynamicTool = buildItemsTool(customTypes);
  const dynamicPrompt =
    STATEMENT_ITEMS_SYSTEM + buildCustomTypesPromptSection(customTypes);

  async function call(chosenModel: typeof model, chosenMaxTokens: number) {
    const response = await anthropic().messages.create({
      model: chosenModel,
      max_tokens: chosenMaxTokens,
      system: [
        { type: "text", text: dynamicPrompt, cache_control: { type: "ephemeral" } },
      ],
      tools: [dynamicTool],
      tool_choice: { type: "tool", name: "record_items" },
      messages: [
        {
          role: "user",
          content: [
            attachment,
            {
              type: "text",
              text: "Extraé TODOS los consumos del resumen (puede haber 50-150 items en múltiples páginas). No te saltees ninguno. Aplicá las exclusiones (pagos, IVA, percepciones, intereses, etc.).",
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { success: false as const, stopReason: response.stop_reason };
    }
    const input = toolUse.input as { items: StatementItem[] };
    return {
      success: true as const,
      items: input.items ?? [],
      stopReason: response.stop_reason,
    };
  }

  // Intento primero con el modelo elegido por auto-switch
  let result = await call(model, maxTokens);

  // Fallback a Sonnet si Haiku truncó (max_tokens) o no llamó tool
  if (
    !result.success ||
    (result.success && result.items.length === 0 && result.stopReason === "max_tokens") ||
    (result.success && result.items.length === 0 && model !== "claude-sonnet-4-6")
  ) {
    if (model !== "claude-sonnet-4-6") {
      result = await call("claude-sonnet-4-6", 16000);
    }
  }

  if (!result.success) {
    throw new Error(`Extraction failed. Stop reason: ${result.stopReason}`);
  }
  return result.items;
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
