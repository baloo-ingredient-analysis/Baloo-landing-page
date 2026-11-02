import { streamObject } from "ai";
import { after } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { analysisSchema } from "@/lib/schema";
import { analysisPrompt } from "@/lib/prompts";
import { cacheSet } from "@/lib/cache";
import { ANALYSIS_MAX_TOKENS, MODEL } from "@/lib/config";
import { mockAnalyzeStream } from "@/lib/mock";
import { recordScan } from "@/lib/stats";
import { ingestAnalysis } from "@/lib/ingest";
import { geolocation } from "@vercel/functions";
import { checkLimit, clientIp, tooMany } from "@/lib/ratelimit";

export const maxDuration = 60;

// Phase 2 of the flow: stream the per-ingredient analysis so cards render one by one.
// Consumed on the client by useObject. Writes the finished result to cache on completion.
export async function POST(req: Request) {
  // Dev/design mode: stream canned cards (no keys, no Claude) so the UI is fully previewable.
  // Gated on the key being ABSENT so a stray MOCK_PIPELINE can't shadow a real key.
  if (process.env.MOCK_PIPELINE && !process.env.ANTHROPIC_API_KEY) return mockAnalyzeStream();

  // S1: cap the paid streaming analysis per IP before spending on Claude. Fail-open without Upstash.
  const rl = await checkLimit("analyse", clientIp(req));
  if (!rl.ok) return tooMany(rl.reset);

  const body = await req.json();
  const { product_name, retailer, ingredients_list, percentages, nutrition, key, url, imageUrl } = body;

  // Country-level only, for the scan board. Undefined in local dev (no Vercel headers).
  const { country } = geolocation(req);

  const result = streamObject({
    model: anthropic(MODEL),
    schema: analysisSchema,
    // Without this the SDK caps output at 4096 tokens: a long label truncates mid-stream, the
    // final object never validates, and the after() persist below throws — so the cache write,
    // the catalog ingest AND the scan record are all silently lost. (Order P2.)
    maxTokens: ANALYSIS_MAX_TOKENS,
    prompt: analysisPrompt({
      product_name,
      retailer,
      ingredients_list: ingredients_list ?? [],
      percentages: percentages ?? [],
    }),
  });

  // Persist AFTER the response streams out. streamObject's own onFinish runs inside the stream
  // lifecycle, but on Vercel the function is frozen the moment the response flushes, so those
  // writes get dropped (observed in prod: neither the cache nor the scan persisted). after()
  // keeps the function alive until this completes — the same pattern the extract cache-hit path
  // uses. result.object resolves to the validated analysis once streaming finishes; it never
  // slows the user, and errors are swallowed so the flow is never affected.
  after(async () => {
    try {
      const object = await result.object;
      if (!object?.ingredients?.length) return;
      if (key) {
        await cacheSet(key, {
          product_name,
          retailer,
          url,
          ingredients: object.ingredients,
          nutrition,
          product_summary: object.product_summary,
        });
      }
      // Phase 3: persist a canonical, deduplicated product (silent no-op without a DB).
      await ingestAnalysis({
        product_name,
        retailer,
        url,
        imageUrl, // scraped packshot (og:image) from /api/extract; ingest also falls back to OFF by barcode
        ingredients: object.ingredients,
        product_summary: object.product_summary,
        nutrition,
      });
      await recordScan({ product_name, retailer, country });
    } catch (err) {
      console.error("analyze persist error:", err);
    }
  });

  return result.toTextStreamResponse();
}
