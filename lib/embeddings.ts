// Text embeddings for semantic search (SS1). Isolated here so the provider is swappable and the
// rest of the app never imports an embedding SDK directly.
//
// Provider: OpenAI `text-embedding-3-small` (1536-d) via the AI SDK — same tooling family as the
// analysis path's `@ai-sdk/anthropic` (Claude has no embeddings API). Cheap (~$0.02 / 1M tokens).
//
// OPTIONAL-INFRA (same rule as Redis/DB): without OPENAI_API_KEY every call returns null and the
// caller falls back to keyword search. Errors are swallowed to null — embeddings must never break a
// request or the ingest flow.

import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

export function embeddingsEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** One embedding, or null when disabled / on error. */
export async function embedText(text: string): Promise<number[] | null> {
  if (!embeddingsEnabled() || !text.trim()) return null;
  try {
    const { embedding } = await embed({ model: openai.embedding(EMBEDDING_MODEL), value: text });
    return embedding;
  } catch (err) {
    console.error("embedText error (ignored):", err);
    return null;
  }
}

/** Batch embeddings (for the backfill). Same length as input; entries are null on failure/disabled. */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (!embeddingsEnabled() || texts.length === 0) return texts.map(() => null);
  try {
    const { embeddings } = await embedMany({
      model: openai.embedding(EMBEDDING_MODEL),
      values: texts,
    });
    return embeddings;
  } catch (err) {
    console.error("embedTexts error (ignored):", err);
    return texts.map(() => null);
  }
}

/**
 * The text we embed for a product: what the product IS, in the words a searcher would use — brand,
 * name, the one-sentence summary, and the ingredient names. This is what lets "dairy-free milk"
 * match an oat drink. Capped so a huge ingredient list can't blow the input budget.
 */
export function productEmbeddingText(input: {
  name: string;
  brand?: string | null;
  summary?: string | null;
  ingredientNames?: string[];
}): string {
  const parts = [
    input.brand,
    input.name,
    input.summary,
    input.ingredientNames?.slice(0, 30).join(", "),
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  return parts.join(". ").slice(0, 8000);
}

/**
 * The text we embed for a public list (L3): its title + description — the curator's own words for the
 * theme, which is what a searcher's intent ("kids cereals without junk") matches against. Item names
 * are deliberately left out: they change as items are added, and the title/description carry the theme
 * and are what exists at create time. Capped so a long description can't blow the input budget.
 */
export function listEmbeddingText(input: { title: string; description?: string | null }): string {
  const parts = [input.title, input.description].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  return parts.join(". ").slice(0, 8000);
}

/** pgvector literal for a raw SQL query: [0.1,0.2,…]. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
