export const MES_ACTUAL = "Abril 2026";

export type CategoriaKey = "servicios" | "tarjeta" | "expensas" | "impuestos" | "compras" | "suscrip" | "debito";

export const CATEGORIAS: Record<CategoriaKey, { label: string; color: string; soft: string; icon: string }> = {
  servicios: { label: "Servicios", color: "var(--blue)", soft: "var(--blue-soft)", icon: "⚡" },
  tarjeta:   { label: "Tarjeta",   color: "var(--red)",  soft: "var(--red-soft)",  icon: "💳" },
  expensas:  { label: "Expensas",  color: "var(--orange)", soft: "var(--orange-soft)", icon: "🏢" },
  impuestos: { label: "Impuestos", color: "var(--purple)", soft: "var(--purple-soft)", icon: "📋" },
  compras:   { label: "Compras",   color: "var(--pink)", soft: "var(--pink-soft)", icon: "📦" },
  suscrip:   { label: "Suscrip.",  color: "var(--green)", soft: "var(--green-soft)", icon: "🎬" },
  debito:    { label: "Débito",    color: "#8c8c8c", soft: "#dcdcdc", icon: "🏦" },
};

export type Pendiente = {
  id: number;
  proveedor: string;
  concepto: string;
  monto: number;
  moneda: "ARS" | "USD";
  cat: CategoriaKey;
  vence: string;
  from: string;
  confianza: number;
};

export const PENDIENTES: Pendiente[] = [
  { id: 1, proveedor: "Edenor",        concepto: "Factura luz - Mar/26",   monto: 24580,   moneda: "ARS", cat: "servicios", vence: "2026-04-22", from: "facturacion@edenor.com.ar", confianza: 98 },
  { id: 2, proveedor: "Netflix",       concepto: "Plan Premium",            monto: 11990,   moneda: "ARS", cat: "suscrip",   vence: "2026-04-24", from: "info@netflix.com", confianza: 99 },
  { id: 3, proveedor: "Visa Galicia",  concepto: "Resumen tarjeta",         monto: 412350,  moneda: "ARS", cat: "tarjeta",   vence: "2026-04-28", from: "resumen@bancogalicia.com.ar", confianza: 97 },
  { id: 4, proveedor: "AySA",          concepto: "Agua bimestral",          monto: 8720,    moneda: "ARS", cat: "servicios", vence: "2026-04-30", from: "facturas@aysa.com.ar", confianza: 95 },
  { id: 5, proveedor: "AWS",           concepto: "Cloud services",          monto: 42.80,   moneda: "USD", cat: "suscrip",   vence: "2026-05-02", from: "no-reply@amazon.com", confianza: 92 },
  { id: 6, proveedor: "Expensas Libertador 2340", concepto: "Abril 2026", monto: 185000, moneda: "ARS", cat: "expensas", vence: "2026-05-05", from: "administracion@tuexpensa.com", confianza: 88 },
];

export type Pagado = {
  id: number;
  proveedor: string;
  concepto: string;
  monto: number;
  cat: CategoriaKey;
  fecha: string;
  via: string;
};

export const PAGADOS_MES: Pagado[] = [
  { id: 101, proveedor: "Metrogas",    concepto: "Gas natural",             monto: 6430,    cat: "servicios", fecha: "2026-04-03", via: "Débito auto" },
  { id: 102, proveedor: "Personal",    concepto: "Celular + internet",       monto: 18990,   cat: "servicios", fecha: "2026-04-05", via: "Telegram OK" },
  { id: 103, proveedor: "Spotify",     concepto: "Plan Familiar",            monto: 3890,    cat: "suscrip",   fecha: "2026-04-06", via: "Telegram OK" },
  { id: 104, proveedor: "ABL CABA",    concepto: "Cuota 04/12",              monto: 9250,    cat: "impuestos", fecha: "2026-04-10", via: "Telegram OK" },
  { id: 105, proveedor: "MercadoLibre",concepto: "Cafetera Moulinex",        monto: 189990,  cat: "compras",   fecha: "2026-04-11", via: "Aprobado" },
  { id: 106, proveedor: "Claude Pro",  concepto: "Suscripción mensual",      monto: 20500,   cat: "suscrip",   fecha: "2026-04-12", via: "Telegram OK" },
  { id: 107, proveedor: "ARBA",        concepto: "Patente auto 02/12",       monto: 32100,   cat: "impuestos", fecha: "2026-04-14", via: "Telegram OK" },
  { id: 108, proveedor: "Rappi",       concepto: "Rappi Prime",              monto: 4590,    cat: "suscrip",   fecha: "2026-04-16", via: "Débito auto" },
];

export type HistoricoPunto = { mes: string; total: number; prom: number; parcial?: boolean };

export const HISTORICO: HistoricoPunto[] = [
  { mes: "Oct '25", total: 685000, prom: 680000 },
  { mes: "Nov '25", total: 742300, prom: 695000 },
  { mes: "Dic '25", total: 910400, prom: 720000 },
  { mes: "Ene '26", total: 820100, prom: 740000 },
  { mes: "Feb '26", total: 758900, prom: 755000 },
  { mes: "Mar '26", total: 824600, prom: 770000 },
  { mes: "Abr '26", total: 678840, prom: 778000, parcial: true },
];

export type Insight = {
  tipo: "alerta" | "insight" | "recordatorio" | "descubierto";
  titulo: string;
  detalle: string;
  color: "red" | "green" | "yellow" | "blue";
};

export const INSIGHTS: Insight[] = [
  { tipo: "alerta", titulo: "Netflix subió 18%", detalle: "De $10.150 a $11.990. Hace 2 meses.", color: "red" },
  { tipo: "insight", titulo: "Gastás 32% menos que en marzo", detalle: "Gracias al pausado de Disney+ y Crunchyroll.", color: "green" },
  { tipo: "recordatorio", titulo: "Visa vence en 4 días", detalle: "$412.350 — el saldo más alto del año.", color: "yellow" },
  { tipo: "descubierto", titulo: "Suscripción nueva detectada", detalle: "Figma Pro — ¿la conocés?", color: "blue" },
];

export const TOTAL_ARS_MES = PAGADOS_MES.reduce((s, g) => s + g.monto, 0);
export const PENDIENTE_ARS = PENDIENTES.filter(p => p.moneda === "ARS").reduce((s, g) => s + g.monto, 0);
export const PENDIENTE_USD = PENDIENTES.filter(p => p.moneda === "USD").reduce((s, g) => s + g.monto, 0);
export const USD_RATE = 1285;
