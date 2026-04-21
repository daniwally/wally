import { supabase, WALLY_USER_ID } from "./supabase";

export function getSenderKey(
  sourceFrom: string | null,
  provider: string | null,
): string | null {
  if (sourceFrom) {
    const match = sourceFrom.match(/<([^>]+)>/);
    if (match) return match[1].toLowerCase();
    if (/@[^\s@]+$/.test(sourceFrom) && !/\s/.test(sourceFrom)) {
      return sourceFrom.toLowerCase();
    }
  }
  if (provider) return provider.trim().toLowerCase();
  return null;
}

export async function applyLearnedCategory(
  claudeCategory: string | null,
  sourceFrom: string | null,
  provider: string | null,
): Promise<string | null> {
  const senderKey = getSenderKey(sourceFrom, provider);
  if (!senderKey) return claudeCategory;

  const { data: rule } = await supabase()
    .from("rules")
    .select("category_id")
    .eq("user_id", WALLY_USER_ID)
    .eq("sender_pattern", senderKey)
    .eq("active", true)
    .maybeSingle();

  return rule?.category_id ?? claudeCategory;
}
