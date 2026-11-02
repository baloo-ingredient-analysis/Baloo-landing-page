// The analysis pipeline (Order P2), lifted out of the route handlers so it can be called from
// BOTH the streamed paste-flow and the background job — and, per CLAUDE.md's portability rule,
// from the future mobile app. Framework-agnostic: no next/* imports, no Request/Response.
//
// The streamed paste-flow keeps `streamObject` in its own route (streaming is a transport
// concern); it shares this file's schema + prompt, so there is exactly one definition of what an
// analysis is.

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { analysisSchema, extractionSchema, type Analysis, type Extraction } from "../schema";
import { analysisPrompt, extractionPrompt } from "../prompts";
import { scrapePage } from "../firecrawl";
import { ANALYSIS_MAX_TOKENS, MODEL } from "../config";

export type AnalyseInput = {
  product_name: string;
  retailer: string;
  ingredients_list: string[];
  percentages: { ingredient: string; percentage: string }[];
};

/** Firecrawl → Claude extract. Returns null when the page yields nothing usable. */
export async function scrapeAndExtract(url: string): Promise<(Extraction & { imageUrl: string | null }) | null> {
  if (!process.env.FIRECRAWL_API_KEY || !process.env.ANTHROPIC_API_KEY) return null;

  const page = await scrapePage(url);
  if (!page) return null;

  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: extractionSchema,
    prompt: extractionPrompt(page.markdown),
  });

  if (!object.ingredients_list?.length) return null;
  // Carry the scraped packshot (og:image) alongside the extraction so the paste flow persists it as
  // products.image_url — the source a share-card hero is later generated from.
  return { ...object, imageUrl: page.imageUrl };
}

/**
 * The per-ingredient analysis, NON-streaming — for the background job. The paste-flow streams the
 * same prompt/schema so cards render one by one; here nobody is watching, so we just await it.
 */
export async function analyseIngredients(input: AnalyseInput): Promise<Analysis> {
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: analysisSchema,
    maxTokens: ANALYSIS_MAX_TOKENS, // 4096 (the SDK default) truncates long labels — see config.ts
    prompt: analysisPrompt(input),
  });
  return object;
}
