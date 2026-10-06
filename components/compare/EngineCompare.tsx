"use client";

// Internal engine-compare tool (feat/engine-compare): pick a catalog product, see OUR stored analysis
// next to the recognition engine's output (adapted to our shapes) — ingredients, nutrition, summary.
// The point is to eyeball quality + tone before the flagged swap: the engine column also shows each
// ingredient's RAW 3-value processing_tag (so the artificial→Processed fold is visible) and its
// source-language canonical_name. Not linked anywhere; the page is noindex.

import { useEffect, useRef, useState } from "react";

type Pick = { slug: string; name: string; brand: string | null };
type Nutrient = { name: string; per_100g: string | null; per_serving: string | null; unit: string };
type NutritionBlock = { per: string; nutrients: Nutrient[] } | null;

type OurIngredient = {
  name: string;
  tag: "Natural" | "Processed" | null;
  role: string | null;
  percent: string | null;
  whatItIs: string | null;
  whyItsHere: string | null;
  percentageNote: string | null;
};
type EngineIngredient = {
  name: string;
  tag: "Natural" | "Processed";
  role: string;
  percentage: string | null;
  what_it_is: string;
  why_its_here: string;
  percentage_note: string | null;
};
type RawIngredient = { canonical_name: string; processing_tag: string | null; percent: number | null; percent_type: string | null; role_tags: string[] };

type CompareResult = {
  product: { name: string; slug: string; barcode: string | null };
  ours: { summary: string | null; nutrition: NutritionBlock; ingredients: OurIngredient[] };
  engine:
    | { ok: true; summary: string; nutrition: NutritionBlock; ingredients: EngineIngredient[]; raw: RawIngredient[] }
    | { ok: false; reason: string };
};

// A normalized row so both sides render through one component.
type Row = {
  name: string;
  tag: "Natural" | "Processed" | null;
  role: string | null;
  percent: string | null;
  whatItIs: string | null;
  whyItsHere: string | null;
  rawTag?: string | null; // engine only — the 3-value tag before our fold
};

function TagPill({ tag, rawTag }: { tag: Row["tag"]; rawTag?: string | null }) {
  const cls = tag === "Natural" ? "bg-natural/10 text-natural" : tag === "Processed" ? "bg-processed/10 text-processed" : "bg-canvas text-muted";
  const folded = rawTag && rawTag !== "natural" && rawTag !== "processed"; // e.g. "artificial"
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{tag ?? "—"}</span>
      {folded && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-muted">raw: {rawTag}</span>}
    </span>
  );
}

function IngredientList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-muted">No ingredients.</p>;
  return (
    <ul className="mt-2 space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="rounded-xl border border-line bg-paper p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-muted">{i + 1}</span>
            <span className="font-medium text-ink">{r.name}</span>
            <TagPill tag={r.tag} rawTag={r.rawTag} />
            {r.percent && <span className="text-xs tabular-nums text-muted">{r.percent}</span>}
            {r.role && <span className="text-[11px] text-muted">· {r.role}</span>}
          </div>
          {r.whatItIs && <p className="mt-1 text-xs leading-relaxed text-ink/70"><b className="text-ink/80">What it is. </b>{r.whatItIs}</p>}
          {r.whyItsHere && <p className="mt-1 text-xs leading-relaxed text-ink/70"><b className="text-ink/80">Why it's here. </b>{r.whyItsHere}</p>}
        </li>
      ))}
    </ul>
  );
}

function NutritionTable({ n }: { n: NutritionBlock }) {
  if (!n || n.nutrients.length === 0) return <p className="mt-2 text-sm text-muted">No nutrition panel.</p>;
  return (
    <table className="mt-2 w-full text-sm">
      <tbody>
        {n.nutrients.map((x, i) => (
          <tr key={i} className="border-t border-line first:border-t-0">
            <td className="py-1 text-ink/80">{x.name}</td>
            <td className="py-1 text-right tabular-nums text-ink">{(x.per_100g ?? x.per_serving) ?? "—"}{x.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Column({ title, tone, children }: { title: string; tone: "natural" | "ink"; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={`text-xs font-semibold uppercase tracking-[0.12em] ${tone === "natural" ? "text-natural" : "text-ink"}`}>{title}</h2>
      {children}
    </section>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      {children}
    </div>
  );
}

export function EngineCompare() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Pick[]>([]);
  const [picked, setPicked] = useState<Pick | null>(null);
  const [data, setData] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Debounced catalog search for the picker.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    if (picked || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products/search?q=${encodeURIComponent(q.trim())}`).then((x) => x.json());
        setResults(r.products ?? []);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  async function pick(p: Pick) {
    setPicked(p);
    setResults([]);
    setQ(p.name);
    setData(null);
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/compare/engine?slug=${encodeURIComponent(p.slug)}`);
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch {
      setErr("Couldn't load the comparison. Try another product.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPicked(null);
    setData(null);
    setQ("");
    setErr(null);
  }

  const ourRows: Row[] = (data?.ours.ingredients ?? []).map((i) => ({
    name: i.name, tag: i.tag, role: i.role, percent: i.percent, whatItIs: i.whatItIs, whyItsHere: i.whyItsHere,
  }));
  const engineRows: Row[] =
    data && data.engine.ok
      ? data.engine.ingredients.map((i, idx) => ({
          name: i.name, tag: i.tag, role: i.role, percent: i.percentage, whatItIs: i.what_it_is, whyItsHere: i.why_its_here,
          rawTag: data.engine.ok ? data.engine.raw[idx]?.processing_tag ?? null : null,
        }))
      : [];

  return (
    <div>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (picked) setPicked(null);
          }}
          placeholder="Search a catalog product to compare…"
          aria-label="Compare product search"
          className="w-full rounded-full border border-line bg-paper px-5 py-3 text-ink shadow-card outline-none transition focus:border-natural focus:ring-2 focus:ring-natural/20"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-paper shadow-card">
            {results.map((p) => (
              <li key={p.slug}>
                <button type="button" onClick={() => pick(p)} className="block w-full px-4 py-2.5 text-left hover:bg-canvas">
                  <span className="font-medium text-ink">{p.name}</span>
                  {p.brand && <span className="text-muted"> · {p.brand}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-natural" />
          Running both sides (the engine may call Claude on a cold product)…
        </p>
      )}
      {err && <p className="mt-4 text-sm text-processed" role="alert">{err}</p>}

      {data && !loading && (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl text-ink">{data.product.name}</h2>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>barcode: {data.product.barcode ?? "—"}</span>
              <button type="button" onClick={reset} className="font-medium text-natural hover:underline">change</button>
            </div>
          </div>

          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <Column title="Our pipeline" tone="natural">
              <p className="mt-1 text-xs text-muted">What the live site shows today.</p>
              <Block label="Summary"><p className="mt-1 text-sm text-ink/80">{data.ours.summary ?? "—"}</p></Block>
              <Block label={`Ingredients (${ourRows.length})`}><IngredientList rows={ourRows} /></Block>
              <Block label="Nutrition"><NutritionTable n={data.ours.nutrition} /></Block>
            </Column>

            <Column title="Recognition engine" tone="ink">
              {data.engine.ok ? (
                <>
                  <p className="mt-1 text-xs text-muted">Igor's engine, adapted to our shapes. <code className="rounded bg-canvas px-1">raw:</code> shows the 3-value tag before our fold.</p>
                  <Block label="Summary"><p className="mt-1 text-sm text-ink/80">{data.engine.summary || "—"}</p></Block>
                  <Block label={`Ingredients (${engineRows.length})`}><IngredientList rows={engineRows} /></Block>
                  <Block label="Nutrition"><NutritionTable n={data.engine.nutrition} /></Block>
                </>
              ) : (
                <p className="mt-3 rounded-2xl border border-dashed border-line bg-paper p-4 text-sm text-muted">
                  Engine returned no analysis for this product — <b className="text-ink">{data.engine.reason}</b>.
                  {data.engine.reason === "no_barcode" && " This catalog row has no barcode to resolve."}
                  {data.engine.reason === "disabled" && " The recognition keys aren't set in this environment."}
                </p>
              )}
            </Column>
          </div>
        </div>
      )}
    </div>
  );
}
