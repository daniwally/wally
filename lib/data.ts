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

const MES_INICIO = "2026-04-01";
const MES_FIN = "2026-05-01";

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
  const { data, error } = await supabase()
    .from("expenses")
    .select("*")
    .eq("user_id", WALLY_USER_ID)
    .in("status", ["paid", "auto_approved"])
    .gte("paid_at", MES_INICIO)
    .lt("paid_at", MES_FIN)
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

export async function getDashboardData() {
  const [categorias, pendientes, pagados, insights] = await Promise.all([
    getCategories(),
    getPendientes(),
    getPagadosMes(),
    getInsights(),
  ]);

  const totalArsMes = pagados
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount_cents, 0) / 100;

  const pendienteArs = pendientes
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount_cents, 0) / 100;

  const catMap = new Map(categorias.map((c) => [c.id, c]));

  return { categorias, catMap, pendientes, pagados, insights, totalArsMes, pendienteArs };
}
