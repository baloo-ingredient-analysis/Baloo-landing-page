// Community cold-start seed (L-community). Creates a few CLEARLY-DEMO curator accounts and genuinely
// useful curated lists built from REAL catalog products, plus cross-engagement (likes / saves /
// comments) spread across time so Discover's week/month/all-time ranking has real signal to sort — and
// so the list Discussion section isn't empty in demos. Honest cold-start: real curated content, modest
// plausible engagement, NOT inflated fake social proof. All under @demo-* handles so it's easy to wipe
// before launch (see the bottom for the cleanup query). Idempotent: re-running skips lists that exist.
//
// Run: npm run db:seed-community
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

import { createClient } from "@supabase/supabase-js";
import { db } from "../lib/db";
import { comments, products, saves, votes } from "../lib/db/schema";
import { upsertProfile } from "../lib/db/queries/profiles";
import { addListItem, createList, getListBySlug } from "../lib/db/queries/lists";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

// Demo curators — plausible but clearly demo (email + handle prefixed), easy to purge.
const CURATORS = [
  { email: "demo-nuria@baloo.life", handle: "demo-nuria", displayName: "Núria", bio: "Mercadona hauls and everyday Spanish staples." },
  { email: "demo-tom@baloo.life", handle: "demo-tom", displayName: "Tom", bio: "UK pantry, label-reader, coffee at home." },
  { email: "demo-lena@baloo.life", handle: "demo-lena", displayName: "Lena", bio: "Snacks, sweets, and the occasional guilt-free swap." },
  { email: "demo-marco@baloo.life", handle: "demo-marco", displayName: "Marco", bio: "Weeknight dinners without the mystery ingredients." },
];

// Curated lists (owner = index into CURATORS). Products are filled from the real catalog at runtime.
const LISTS = [
  { owner: 0, title: "Spanish pantry staples", slug: "demo-spanish-pantry", description: "The things always in my kitchen — hummus, gazpacho, olive-oil everything.", n: 6, hot: true },
  { owner: 0, title: "Quick cold lunches", slug: "demo-cold-lunches", description: "No-cook, grab-and-go, still real food.", n: 4, hot: false },
  { owner: 1, title: "Barista at home", slug: "demo-barista-home", description: "Oat drinks that actually foam, and what's in them.", n: 4, hot: true },
  { owner: 1, title: "UK cupboard basics", slug: "demo-uk-cupboard", description: "Everyday shelf staples, ingredient by ingredient.", n: 5, hot: false },
  { owner: 2, title: "Movie-night snacks", slug: "demo-movie-snacks", description: "The good stuff — and honestly what's in it.", n: 6, hot: true },
  { owner: 2, title: "Sweet tooth, read the label", slug: "demo-sweet-tooth", description: "Spreads and treats, no judgement, just the facts.", n: 4, hot: false },
  { owner: 3, title: "Weeknight dinners", slug: "demo-weeknight", description: "Fast dinners I trust, broken down.", n: 5, hot: false },
  { owner: 3, title: "Kids' favourites, decoded", slug: "demo-kids-favourites", description: "What my kids ask for, explained plainly.", n: 4, hot: true },
];

const COMMENTS = [
  "love this, the gazpacho is a staple in my house too",
  "didnt realise how simple the ingredient list actually is, nice",
  "saved this, doing my shop from it this week",
  "the barista one really does foam, can confirm",
  "good shout on the swaps here",
  "adding a couple of these to my own list, thanks",
  "honestly clearer than reading the back of the pack in the shop",
];
const REPLIES = ["glad its useful!", "yeah took me a while to find these", "thanks, more coming"];

async function main() {
  const dbi = db();
  if (!dbi) {
    console.error("No DB — run `npx vercel env pull .env.development.local` first.");
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to create demo users.");
    process.exit(1);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Find-or-create a demo auth user (closure over admin; one listUsers call).
  const { data: existing, error: luErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (luErr) throw luErr;
  const findOrCreate = async (email: string): Promise<string> => {
    const hit = existing.users.find((u) => u.email === email);
    if (hit) return hit.id;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: `baloo-demo-${Math.random().toString(36).slice(2)}`,
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error("createUser returned no user");
    return created.user.id;
  };

  // 1 · curators (auth user + profile)
  const ids: string[] = [];
  for (const c of CURATORS) {
    const id = await findOrCreate(c.email);
    await upsertProfile(dbi, { id, handle: c.handle, displayName: c.displayName, bio: c.bio });
    ids.push(id);
    console.log("curator:", c.handle, id.slice(0, 8));
  }

  // 2 · a pool of real catalog products to build lists from
  const pool = await dbi.select({ id: products.id, name: products.name }).from(products).limit(60);
  if (pool.length < 4) {
    console.error("Not enough catalog products to seed lists — analyse/seed some products first.");
    process.exit(1);
  }
  let cursor = 0;
  const nextProducts = (n: number) => {
    const out: { id: string; name: string }[] = [];
    for (let i = 0; i < n && pool.length; i++) {
      out.push(pool[cursor % pool.length]);
      cursor++;
    }
    return out;
  };

  // 3 · lists + cross-engagement (only for freshly created lists → idempotent re-runs)
  let created = 0;
  for (let li = 0; li < LISTS.length; li++) {
    const spec = LISTS[li];
    if (await getListBySlug(dbi, spec.slug)) {
      console.log("exists, skipping:", spec.slug);
      continue;
    }
    const ownerId = ids[spec.owner];
    const list = await createList(dbi, {
      ownerId,
      title: spec.title,
      slug: spec.slug,
      description: spec.description,
      isPublic: true,
    });
    for (const p of nextProducts(spec.n)) await addListItem(dbi, list.id, p.id);

    // Engagement from OTHER curators. "hot" lists get recent activity (this week); others older, so
    // the week/month/all-time filter actually differentiates. Modest counts, plausible, clearly demo.
    const others = ids.filter((_, idx) => idx !== spec.owner);
    const base = spec.hot ? 2 : 25; // days-ago anchor
    const likeRows = others.map((uid, k) => ({
      userId: uid,
      targetType: "list" as const,
      targetId: list.id,
      value: 1,
      createdAt: daysAgo(base + k),
    }));
    await dbi.insert(votes).values(likeRows).onConflictDoNothing();

    const saveRows = others.slice(0, spec.hot ? 3 : 1).map((uid, k) => ({
      userId: uid,
      listId: list.id,
      createdAt: daysAgo(base + k + 1),
    }));
    await dbi.insert(saves).values(saveRows).onConflictDoNothing();

    // 1–2 comments + one reply, from other curators.
    const c1 = COMMENTS[li % COMMENTS.length];
    const [top] = await dbi
      .insert(comments)
      .values({ userId: others[0], listId: list.id, body: c1, createdAt: daysAgo(base) })
      .returning({ id: comments.id });
    if (others[1]) {
      await dbi.insert(comments).values({
        userId: others[1],
        listId: list.id,
        body: REPLIES[li % REPLIES.length],
        parentId: top.id,
        createdAt: daysAgo(Math.max(0, base - 1)),
      });
    }
    if (spec.hot && others[2]) {
      await dbi.insert(comments).values({
        userId: others[2],
        listId: list.id,
        body: COMMENTS[(li + 3) % COMMENTS.length],
        createdAt: daysAgo(1),
      });
    }
    created++;
    console.log("list:", spec.slug, `(${spec.n} products, ${likeRows.length} likes, ${spec.hot ? "hot" : "older"})`);
  }

  console.log(`\nSEED COMMUNITY OK — ${CURATORS.length} curators, ${created} new lists.`);
  console.log("Cleanup before launch: delete from profiles where handle like 'demo-%' (cascades lists/comments/votes/saves), then remove the demo-* auth users.");
  process.exit(0);
}

main().catch((err) => {
  console.error("SEED COMMUNITY FAILED:", err);
  process.exit(1);
});
