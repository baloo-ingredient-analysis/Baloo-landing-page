// Auto-generated list metadata (AEO + tags track): a FEW controlled tags for navigation/filtering,
// and ONE short human-readable, synonym-rich discovery sentence for the page + search + answer engines
// (Jitain's split: controlled tags for nav, a discovery description for understanding — and it's for
// humans too, so a list feels curated). Framework-agnostic; optional-infra (no key → null, nothing
// breaks); best-effort (any failure → null, never blocks the list flow).

import { z } from "zod";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MODEL } from "./config";

export type ListMeta = { tags: string[]; discovery: string };

const listMetaSchema = z.object({
  tags: z
    .array(z.string())
    .describe(
      "2 to 5 SHORT, lowercase, BROAD navigation tags a person would filter by — reusable categories " +
        "like 'snacks', 'kids', 'breakfast', 'vegan', 'high-protein', 'drinks'. Not synonyms, not long " +
        "phrases, not brand or product names.",
    ),
  discovery: z
    .string()
    .describe(
      "ONE short natural sentence (~25 words) describing what the list is for, phrased so it also " +
        "covers common equivalent ways people search for it. Curated, human, neutral — never a health " +
        "score, rating, or good/bad verdict.",
    ),
});

export async function generateListMeta(input: {
  title: string;
  description?: string | null;
  products: string[];
}): Promise<ListMeta | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: listMetaSchema,
      prompt:
        `You label a food-product list for Baloo, a calm, neutral food app. Education over judgement — ` +
        `never a health score, rating, or good/bad verdict.\n\n` +
        `List title: "${input.title}"\n` +
        (input.description ? `Description: "${input.description}"\n` : "") +
        (input.products.length ? `Products:\n${input.products.map((p) => `- ${p}`).join("\n")}\n` : "") +
        `\nProduce:\n` +
        `1. tags — 2 to 5 short, lowercase, BROAD navigation categories to filter by (reusable across ` +
        `many lists). Not synonyms, not long phrases, not product names.\n` +
        `2. discovery — ONE short natural sentence (~25 words) for what the list is for, written so it ` +
        `also covers common equivalent phrasings someone might search. Curated, human, neutral.`,
    });
    const tags = [...new Set(object.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
    const discovery = object.discovery.trim();
    if (tags.length === 0 && !discovery) return null;
    return { tags, discovery };
  } catch {
    return null; // best-effort — never break creating/editing a list
  }
}
