export const fmtARS = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

export const fmtUSD = (n: number) =>
  "US$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtMoney = (n: number, moneda: "ARS" | "USD") =>
  moneda === "USD" ? fmtUSD(n) : fmtARS(n);

export const fmtDateShort = (iso: string) => {
  const d = new Date(iso + "T00:00");
  return d.getDate() + "/" + (d.getMonth() + 1);
};

const HOY_ISO = "2026-04-20";

export const diasHasta = (iso: string) => {
  const hoy = new Date(HOY_ISO + "T00:00");
  const d = new Date(iso + "T00:00");
  return Math.round((d.getTime() - hoy.getTime()) / 86400000);
};
