import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

// Demo landing page (not linked from the app). The live product keeps "the homepage IS the tool";
// this is a separate marketing page to explore a dedicated landing, per Jitain's ask. Built on
// Baloo's real design system (warm paper + ink + natural-green, Playfair + Inter), light-only to
// match the brand's single warm world. Noindex so it never competes with the real homepage.
export const metadata: Metadata = {
  title: "Baloo — Know what's in your food",
  description:
    "Paste any supermarket product and Baloo explains every ingredient in plain language: what it is, and why it's there. No score, ever.",
  robots: { index: false, follow: false },
};

const ANALYSE_HREF = "/";
const EXAMPLE_HREF = "/p/oatly-oat-drink-barista-edition";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-canvas text-ink">
      <LandingNav />

      <main>
        <Hero />
        <PositioningBand />
        <HowItWorks />
        <NutritionShowcase />
        <Community />
        <FinalCta />
      </main>

      <LandingFooter />
    </div>
  );
}

/* ─────────────────────────── Nav ─────────────────────────── */

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-line/70 bg-canvas/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Link href={ANALYSE_HREF} aria-label="Baloo home" className="shrink-0">
          <Wordmark className="text-xl" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-5">
          <a href="#how" className="hidden text-sm font-medium text-muted transition hover:text-ink sm:inline">
            How it works
          </a>
          <Link href="/discover" className="hidden text-sm font-medium text-muted transition hover:text-ink sm:inline">
            Discover
          </Link>
          <Link
            href={ANALYSE_HREF}
            className="rounded-full bg-natural px-4 py-2 text-sm font-medium text-paper shadow-card transition hover:bg-natural/90 active:translate-y-px"
          >
            Analyse a product
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ─────────────────────────── Hero ─────────────────────────── */

function Hero() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 pt-14 pb-16 sm:pt-20 sm:pb-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Copy */}
        <div className="animate-fade-in">
          <h1 className="font-display text-[42px] leading-[1.04] tracking-[-0.015em] text-ink sm:text-[56px]">
            Know what&rsquo;s <em className="not-italic text-natural">actually</em> in your food.
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
            Paste any supermarket product. Baloo breaks down every ingredient in plain language: what
            it is, and why it&rsquo;s in there.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={ANALYSE_HREF}
              className="rounded-full bg-natural px-6 py-3 text-[15px] font-medium text-paper shadow-card transition hover:bg-natural/90 active:translate-y-px"
            >
              Analyse a product
            </Link>
            <Link
              href={EXAMPLE_HREF}
              className="rounded-full border border-line bg-paper px-6 py-3 text-[15px] font-medium text-ink shadow-card transition hover:border-natural/40 hover:text-natural active:translate-y-px"
            >
              See a real example
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted">Free. No sign-up to analyse. No score, ever.</p>
        </div>

        {/* Real ingredient-breakdown card (live Baloo UI, not a mockup) */}
        <div className="animate-rise [animation-delay:120ms] lg:justify-self-end">
          <IngredientCard />
        </div>
      </div>
    </section>
  );
}

function Pill({ kind }: { kind: "natural" | "processed" }) {
  const map = {
    natural: { cls: "bg-natural-soft text-natural", dot: "bg-natural", label: "Natural" },
    processed: { cls: "bg-processed-soft text-processed", dot: "bg-processed", label: "Processed" },
  }[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map.cls}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </span>
  );
}

function IngredientCard() {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-paper shadow-hero">
      <div className="border-b border-line px-5 py-4">
        <p className="font-display text-lg leading-tight text-ink">Oatly Oat Drink, Barista Edition</p>
        <p className="mt-1 text-xs text-muted">3 ingredients, in label order. 2 natural, 1 processed.</p>
      </div>

      <div className="divide-y divide-line">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <span className="flex items-baseline gap-2">
            <span className="w-4 text-xs tabular-nums text-muted">1</span>
            <span className="font-medium text-ink">Water</span>
            <span className="text-xs uppercase tracking-[0.08em] text-muted">Base</span>
          </span>
          <Pill kind="natural" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <span className="flex items-baseline gap-2">
            <span className="w-4 text-xs tabular-nums text-muted">2</span>
            <span className="font-medium text-ink">Oats</span>
            <span className="text-xs tabular-nums text-muted">10%</span>
            <span className="text-xs uppercase tracking-[0.08em] text-muted">Base</span>
          </span>
          <Pill kind="natural" />
        </div>

        {/* Expanded row — the signature "what it is / in this product" two-beat */}
        <div className="bg-canvas/40 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-baseline gap-2">
              <span className="w-4 text-xs tabular-nums text-muted">3</span>
              <span className="font-medium text-ink">Rapeseed Oil</span>
              <span className="text-xs uppercase tracking-[0.08em] text-muted">Oil / fat</span>
            </span>
            <Pill kind="processed" />
          </div>
          <div className="mt-3 space-y-3 pl-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">What it is</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">
                A mild cooking oil pressed from rapeseed, one of the most widely used oils in Europe.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">In this product</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">
                Adds a creamy mouthfeel and helps the drink foam when it&rsquo;s steamed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Positioning band ─────────────────────── */

function PositioningBand() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 text-center sm:py-28">
        <h2 className="font-display text-[30px] leading-tight tracking-[-0.01em] text-ink sm:text-[40px]">
          No scores. No scare tactics. No telling you what to buy.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
          Other apps slap a grade on your groceries. Baloo doesn&rsquo;t. We explain what&rsquo;s in
          your food, in plain words, and leave the judgment to you.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── How it works ─────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "Paste a link",
    body: "Drop in any product page from a supported supermarket.",
  },
  {
    n: "02",
    title: "We read the label",
    body: "Baloo pulls the full ingredient list, in the exact order it’s printed.",
  },
  {
    n: "03",
    title: "See it explained",
    body: "Every ingredient, what it is and why it’s there, plus a natural or processed tag.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20 sm:py-28">
      <h2 className="max-w-xl font-display text-[28px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
        From a supermarket link to a clear answer, in seconds.
      </h2>
      <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {STEPS.map((s) => (
          <li key={s.n} className="border-t border-line pt-5">
            <span className="font-display text-3xl text-natural/70 tabular-nums">{s.n}</span>
            <h3 className="mt-3 font-display text-xl text-ink">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─────────────────────── Nutrition showcase ─────────────────────── */

const NUTRIENTS = [
  { name: "Energy", value: "61", unit: " kcal", pct: 3 },
  { name: "Fat", value: "3.0", unit: " g", pct: 4 },
  { name: "Salt", value: "0.10", unit: " g", pct: 2 },
];

function NutritionShowcase() {
  return (
    <section className="border-t border-line bg-paper">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="font-display text-[28px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
            Numbers in context, never a verdict.
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
            The nutrition panel, shown against everyday reference amounts. Neutral bars, real figures,
            no red-and-green theatre. You get the picture and decide for yourself.
          </p>
        </div>

        {/* Real nutrition panel (neutral ink bars, score-free by design) */}
        <div className="lg:justify-self-end">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-canvas/50 p-5 shadow-card">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Per 100 ml</p>
              <p className="text-xs text-muted">% of daily reference</p>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {NUTRIENTS.map((n) => (
                <li key={n.name} className="flex items-center gap-3 py-3">
                  <span className="w-20 shrink-0 text-sm text-ink">{n.name}</span>
                  <span className="w-20 shrink-0 text-sm tabular-nums text-muted">
                    {n.value}
                    {n.unit}
                  </span>
                  <span aria-hidden className="h-1.5 flex-1 rounded-full bg-line">
                    <span className="block h-1.5 rounded-full bg-ink/30" style={{ width: `${n.pct * 8}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">{n.pct}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              General estimate from public UK reference values (FSA / NHS). Not personalised medical or
              dietary advice.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Community ─────────────────────────── */

const LISTS = [
  { title: "Kids&rsquo; favourites, decoded", mono: "K", count: "9 products", by: "marcocooks", likes: 24 },
  { title: "Weeknight dinners", mono: "W", count: "12 products", by: "marcocooks", likes: 18 },
  { title: "Spanish pantry staples", mono: "S", count: "15 products", by: "nuriacocina", likes: 31 },
];

function Community() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-20 sm:py-28">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-natural">Built together</p>
      <h2 className="mt-3 max-w-xl font-display text-[28px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
        Lists from people who actually read labels.
      </h2>
      <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted">
        Browse what the community keeps, swaps, and trusts. Every product on every list, broken down
        ingredient by ingredient.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {LISTS.map((l) => (
          <div
            key={l.mono}
            className="group overflow-hidden rounded-2xl border border-line bg-paper shadow-card transition duration-200 hover:shadow-card-hover"
          >
            <div className="flex h-28 items-center justify-center bg-natural-soft">
              <span aria-hidden className="font-display text-5xl text-natural/35">
                {l.mono}
              </span>
            </div>
            <div className="p-4">
              <h3
                className="font-display text-lg leading-tight text-ink"
                dangerouslySetInnerHTML={{ __html: l.title }}
              />
              <p className="mt-1 text-sm text-muted">by @{l.by}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs tabular-nums text-muted">
                <span>{l.count}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <svg viewBox="0 0 14 13" fill="currentColor" aria-hidden className="h-3 w-3 text-like">
                    <path d="M7 12.1 1.6 6.9a3.2 3.2 0 0 1 4.5-4.5l.9.9.9-.9a3.2 3.2 0 1 1 4.5 4.5L7 12.1z" />
                  </svg>
                  {l.likes}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/discover" className="text-sm font-medium text-natural hover:underline">
          Browse the community &rarr;
        </Link>
      </div>
    </section>
  );
}

/* ─────────────────────────── Final CTA ─────────────────────────── */

function FinalCta() {
  return (
    <section className="border-t border-line bg-natural-soft/50">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 text-center sm:py-28">
        <h2 className="font-display text-[30px] leading-tight tracking-[-0.01em] text-ink sm:text-[40px]">
          See what&rsquo;s in your next shop.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-muted">
          Free to use, no sign-up to analyse, and no score anywhere. Just a clear read on your food.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href={ANALYSE_HREF}
            className="rounded-full bg-natural px-7 py-3.5 text-[15px] font-medium text-paper shadow-card transition hover:bg-natural/90 active:translate-y-px"
          >
            Analyse a product
          </Link>
        </div>
        <p className="mt-6 text-sm text-muted">
          Prefer the app?{" "}
          <Link href={ANALYSE_HREF} className="font-medium text-natural hover:underline">
            Get early access
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── Footer ─────────────────────────── */

function LandingFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto w-full max-w-5xl px-5 py-12">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <Wordmark className="text-base" />
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted">
              Baloo explains what&rsquo;s in packaged food to help you understand labels. It isn&rsquo;t
              medical or dietary advice, and never tells you what to buy or avoid.
            </p>
          </div>
          <nav className="flex gap-6 text-sm text-muted">
            <a href="#how" className="transition hover:text-ink">How it works</a>
            <Link href="/discover" className="transition hover:text-ink">Discover</Link>
            <Link href={ANALYSE_HREF} className="transition hover:text-ink">Analyse</Link>
          </nav>
        </div>
        <p className="mt-8 text-xs text-muted">A prototype for the upcoming Baloo app.</p>
      </div>
    </footer>
  );
}
