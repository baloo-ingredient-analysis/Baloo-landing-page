"use client";

// Baloo landing page (demo). Rebuilt with real motion per 2026 landing-page practice: meaningful
// scroll-reveal, a hero that shows the product value up front (the ingredient breakdown "builds"),
// subtle parallax on a generated editorial hero visual, animated nutrition bars, and hover physics.
// Motion is gated on prefers-reduced-motion. Built on Baloo's real design system (warm paper + ink +
// natural-green, Playfair + Inter), light-only. No judgment colours; score-free guardrail intact.

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "motion/react";
import { Wordmark } from "@/components/Wordmark";

const ANALYSE_HREF = "/";
const EXAMPLE_HREF = "/p/oatly-oat-drink-barista-edition";
const EASE = [0.16, 1, 0.3, 1] as const;

// SSR'd (page.tsx renders this directly) so the content is in the HTML immediately. Every motion
// element keeps a CONSTANT `initial` and there is NO MotionConfig reducedMotion override, so Motion's
// default (ignore the OS reduced-motion preference) renders the same `initial` on server and client —
// no hydration mismatch. useReducedMotion is read only for the hero parallax range, whose value at
// first paint is 0 either way.
export function Landing() {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-canvas text-ink">
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

/* ── Scroll reveal helper ── */
function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ y }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ───────────────────────── Nav ───────────────────────── */

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
          <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
            <Link
              href={ANALYSE_HREF}
              className="inline-block rounded-full bg-natural px-4 py-2 text-sm font-medium text-paper shadow-card"
            >
              Analyse a product
            </Link>
          </motion.span>
        </div>
      </nav>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

const heroStagger: Variants = {
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
// Transform-only (no opacity): content is visible at rest, so a slow or failed JS load never blanks
// the page. Motion just slides it into place.
const heroItem: Variants = {
  hidden: { y: 18 },
  show: { y: 0, transition: { duration: 0.7, ease: EASE } },
};

function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const yPhoto = useTransform(scrollY, [0, 700], reduce ? [0, 0] : [0, -56]);
  const yCard = useTransform(scrollY, [0, 700], reduce ? [0, 0] : [0, 28]);

  return (
    <section className="relative mx-auto w-full max-w-5xl px-5 pt-14 pb-20 sm:pt-20 sm:pb-28">
      {/* soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 right-0 h-72 w-72 rounded-full bg-natural/10 blur-3xl"
      />
      <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
        {/* Copy */}
        <motion.div variants={heroStagger} initial="hidden" animate="show">
          <motion.h1
            variants={heroItem}
            className="font-display text-[42px] leading-[1.04] tracking-[-0.015em] text-ink sm:text-[58px]"
          >
            Know what&rsquo;s <em className="not-italic text-natural">actually</em> in your food.
          </motion.h1>
          <motion.p variants={heroItem} className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
            Paste any supermarket product. Baloo breaks down every ingredient in plain language: what
            it is, and why it&rsquo;s in there.
          </motion.p>
          <motion.div variants={heroItem} className="mt-8 flex flex-wrap items-center gap-3">
            <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
              <Link
                href={ANALYSE_HREF}
                className="inline-block rounded-full bg-natural px-6 py-3 text-[15px] font-medium text-paper shadow-card"
              >
                Analyse a product
              </Link>
            </motion.span>
            <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
              <Link
                href={EXAMPLE_HREF}
                className="inline-block rounded-full border border-line bg-paper px-6 py-3 text-[15px] font-medium text-ink shadow-card transition hover:border-natural/40 hover:text-natural"
              >
                See a real example
              </Link>
            </motion.span>
          </motion.div>
          <motion.p variants={heroItem} className="mt-5 text-sm text-muted">
            Free. No sign-up to analyse. No score, ever.
          </motion.p>
        </motion.div>

        {/* Visual: generated editorial photo (parallax) + the live ingredient card (builds in) */}
        <div className="relative">
          <motion.div
            style={{ y: yPhoto }}
            initial={{ scale: 1.04 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1, ease: EASE }}
            className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] shadow-hero"
          >
            {/* Generated ambient living-photo loop (Higgsfield); the still is the poster + fallback. */}
            <video
              className="absolute inset-0 h-full w-full object-cover"
              poster="/landing/hero-oat.png"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden
            >
              <source src="/landing/hero.mp4" type="video/mp4" />
            </video>
          </motion.div>

          <motion.div
            style={{ y: yCard }}
            className="relative z-10 mx-auto -mt-16 w-[88%] max-w-sm lg:absolute lg:-left-10 lg:bottom-6 lg:mt-0 lg:w-[320px]"
          >
            <IngredientCard />
          </motion.div>
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

const rowStagger: Variants = { show: { transition: { staggerChildren: 0.12, delayChildren: 0.5 } } };
const rowItem: Variants = {
  hidden: { y: 8 },
  show: { y: 0, transition: { duration: 0.5, ease: EASE } },
};

function IngredientCard() {
  return (
    <motion.div
      variants={rowStagger}
      initial="hidden"
      animate="show"
      className="w-full overflow-hidden rounded-2xl border border-line bg-paper/95 shadow-hero backdrop-blur-sm"
    >
      <motion.div variants={rowItem} className="border-b border-line px-4 py-3">
        <p className="font-display text-[15px] leading-tight text-ink">Oatly Oat Drink, Barista Edition</p>
        <p className="mt-0.5 text-[11px] text-muted">3 ingredients. 2 natural, 1 processed.</p>
      </motion.div>
      <div className="divide-y divide-line">
        <motion.div variants={rowItem} className="flex items-center justify-between gap-2 px-4 py-2.5">
          <span className="flex items-baseline gap-2 text-sm">
            <span className="w-3 text-xs tabular-nums text-muted">1</span>
            <span className="font-medium text-ink">Water</span>
          </span>
          <Pill kind="natural" />
        </motion.div>
        <motion.div variants={rowItem} className="flex items-center justify-between gap-2 px-4 py-2.5">
          <span className="flex items-baseline gap-2 text-sm">
            <span className="w-3 text-xs tabular-nums text-muted">2</span>
            <span className="font-medium text-ink">Oats</span>
            <span className="text-xs tabular-nums text-muted">10%</span>
          </span>
          <Pill kind="natural" />
        </motion.div>
        <motion.div variants={rowItem} className="bg-canvas/50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-baseline gap-2 text-sm">
              <span className="w-3 text-xs tabular-nums text-muted">3</span>
              <span className="font-medium text-ink">Rapeseed Oil</span>
            </span>
            <Pill kind="processed" />
          </div>
          <p className="mt-2 pl-5 text-[13px] leading-relaxed text-ink">
            A mild oil pressed from rapeseed. Here it adds a creamy mouthfeel and helps the drink foam.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─────────────────── Positioning band ─────────────────── */

function PositioningBand() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 text-center sm:py-28">
        <Reveal>
          <h2 className="font-display text-[30px] leading-tight tracking-[-0.01em] text-ink sm:text-[40px]">
            No scores. No scare tactics. No telling you what to buy.
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
            Other apps slap a grade on your groceries. Baloo doesn&rsquo;t. We explain what&rsquo;s in
            your food, in plain words, and leave the judgment to you.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────── How it works ───────────────────── */

const STEPS = [
  { n: "01", title: "Paste a link", body: "Drop in any product page from a supported supermarket." },
  { n: "02", title: "We read the label", body: "Baloo pulls the full ingredient list, in the exact order it’s printed." },
  { n: "03", title: "See it explained", body: "Every ingredient, what it is and why it’s there, plus a natural or processed tag." },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20 sm:py-28">
      <Reveal>
        <h2 className="max-w-xl font-display text-[28px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
          From a supermarket link to a clear answer, in seconds.
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}>
            <div className="border-t border-line pt-5">
              <span className="font-display text-3xl text-natural/70 tabular-nums">{s.n}</span>
              <h3 className="mt-3 font-display text-xl text-ink">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────── Nutrition showcase ─────────────────── */

const NUTRIENTS = [
  { name: "Energy", value: "61", unit: " kcal", pct: 3 },
  { name: "Fat", value: "3.0", unit: " g", pct: 4 },
  { name: "Salt", value: "0.10", unit: " g", pct: 2 },
];

function NutritionShowcase() {
  return (
    <section className="border-t border-line bg-paper">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <h2 className="font-display text-[28px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
            Numbers in context, never a verdict.
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
            The nutrition panel, shown against everyday reference amounts. Neutral bars, real figures,
            no red-and-green theatre. You get the picture and decide for yourself.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="lg:justify-self-end">
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
                  <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <motion.span
                      className="block h-1.5 rounded-full bg-ink/30"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${n.pct * 8}%` }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
                    />
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
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── Community ───────────────────────── */

const LISTS = [
  { title: "Kids’ favourites, decoded", mono: "K", count: "9 products", by: "marcocooks", likes: 24 },
  { title: "Weeknight dinners", mono: "W", count: "12 products", by: "marcocooks", likes: 18 },
  { title: "Spanish pantry staples", mono: "S", count: "15 products", by: "nuriacocina", likes: 31 },
];

function Community() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-20 sm:py-28">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-natural">Built together</p>
        <h2 className="mt-3 max-w-xl font-display text-[28px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
          Lists from people who actually read labels.
        </h2>
        <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted">
          Browse what the community keeps, swaps, and trusts. Every product on every list, broken down
          ingredient by ingredient.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {LISTS.map((l, i) => (
          <Reveal key={l.mono} delay={i * 0.1}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="h-full overflow-hidden rounded-2xl border border-line bg-paper shadow-card hover:shadow-card-hover"
            >
              <div className="flex h-28 items-center justify-center bg-natural-soft">
                <span aria-hidden className="font-display text-5xl text-natural/35">{l.mono}</span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg leading-tight text-ink">{l.title}</h3>
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
            </motion.div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mt-8">
          <Link href="/discover" className="text-sm font-medium text-natural hover:underline">
            Browse the community &rarr;
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── Final CTA ───────────────────────── */

function FinalCta() {
  return (
    <section className="border-t border-line bg-natural-soft/50">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 text-center sm:py-28">
        <Reveal>
          <h2 className="font-display text-[30px] leading-tight tracking-[-0.01em] text-ink sm:text-[40px]">
            See what&rsquo;s in your next shop.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-muted">
            Free to use, no sign-up to analyse, and no score anywhere. Just a clear read on your food.
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <motion.div
            className="mt-8 flex justify-center"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
          >
            <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
              <Link
                href={ANALYSE_HREF}
                className="inline-block rounded-full bg-natural px-7 py-3.5 text-[15px] font-medium text-paper shadow-card"
              >
                Analyse a product
              </Link>
            </motion.span>
          </motion.div>
          <p className="mt-6 text-sm text-muted">
            Prefer the app?{" "}
            <Link href={ANALYSE_HREF} className="font-medium text-natural hover:underline">
              Get early access
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

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
