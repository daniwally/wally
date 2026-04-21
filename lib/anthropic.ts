import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  cached = new Anthropic({ apiKey: key });
  return cached;
}
