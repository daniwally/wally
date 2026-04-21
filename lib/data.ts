import { supabase, WALLY_USER_ID } from "./supabase";
import type { CategoriaKey } from "./mock-data";

export type ExpenseRow = {
  id: string;
  provider: string;
  concept: string | null;
  amount_cents: number;
  currency: "ARS" | "USD";
  category_id: CategoriaKey | null;
  due_at: string | null;
  paid_at: string | null;
  detected_at: string;
  status: "pending_approval" | "paid" | "postponed" | "ignored" | "auto_approved";
  paid_via: string | null;
  source_from: string | null;
  confidence_amount: number | null;
};

export type CategoryRow = {
  id: CategoriaKey;
  label: string;
  icon: string | null;
  color: string | null;
  soft_color: string | null;
  sort_order: number;
};

export type InsightRow = {
  id: string;
  type: "alerta" | "insight" | "recordatorio" | "descubierto";
  title: string;
  detail: string | null;
  color: "red" | "green" | "yellow" | "blue";
  created_at: string;
  read_at: string | null;
};

function getMonthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  ).toISOString();
  return { start, end };
}

export async function getCategories() {
  const { data, error } = await supabase()
    .from("categories")
    .select("*")
    .eq("user_id", WALLY_USER_ID)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function getPendientes() {
  const { data, error } = await supabase()
    .from("expenses")
    .select("*")
    .eq("user_id", WALLY_USER_ID)
    .eq("status", "pending_approval")
    .order("due_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExpenseRow[];
}

export async function getPagadosMes() {
  const { start, end } = getMonthBounds();
  const { data, error } = await supabase()
    .from("expenses")
    .select("*")
    .eq("user_id", WALLY_USER_ID)
    .in("status", ["paid", "auto_approved"])
    .gte("paid_at", start)
    .lt("paid_at", end)
    .order("paid_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExpenseRow[];
}

export async function getInsights(limit = 4) {
  const { data, error } = await supabase()
    .from("insights")
    .select("*")
    .eq("user_id", WALLY_USER_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InsightRow[];
}

export type HistPoint = { mes: string; total: number; prom: number; parcial?: boolean };

const MES_ES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export async function getHistorico(monthsBack = 7): Promise<HistPoint[]> {
  const now = new Date();
  const fromDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1),
  );

  const { data, error } = await supabase()
    .from("expenses")
    .select("amount_cents, currency, paid_at")
    .eq("user_id", WALLY_USER_ID)
    .in("status", ["paid", "auto_approved"])
    .eq("currency", "ARS")
    .gte("paid_at", fromDate.toISOString())
    .not("paid_at", "is", null);
  if (error) throw error;

  // Bucket por YYYY-MM
  const byMonth = new Map<string, number>();
  (data ?? []).forEach((e) => {
    if (!e.paid_at) return;
    const d = new Date(e.paid_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + e.amount_cents / 100);
  });

  const points: HistPoint[] = [];
  let runningSum = 0;
  let runningCount = 0;
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const total = byMonth.get(key) ?? 0;
    const yearShort = `'${String(d.getUTCFullYear()).slice(-2)}`;
    const label = `${MES_ES_SHORT[d.getUTCMonth()]} ${yearShort}`;
    runningSum += total;
    runningCount++;
    const prom = runningSum / runningCount;
    points.push({
      mes: label,
      total,
      prom,
      parcial: i === 0, // mes actual = parcial
    });
  }
  return points;
}

export async function getDashboardData() {
  const [categorias, pendientes, pagados, insights, historico] = await Promise.all([
    getCategories(),
    getPendientes(),
    getPagadosMes(),
    getInsights(),
    getHistorico(7),
  ]);

  const totalArsMes = pagados
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount_cents, 0) / 100;

  const pendienteArs = pendientes
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount_cents, 0) / 100;

  const catMap = new Map(categorias.map((c) => [c.id, c]));

  return {
    categorias,
    catMap,
    pendientes,
    pagados,
    insights,
    historico,
    totalArsMes,
    pendienteArs,
  };
}
