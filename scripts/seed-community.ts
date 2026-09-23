// Community cold-start seed (L-community). Creates curator accounts + genuinely useful curated lists
// from REAL catalog products, plus cross-engagement (likes / saves / comments) spread across time so
// Discover's week/month/all-time popularity ranking has real signal, and the list Discussion isn't
// empty. The curators read as real users (real names/handles/bios); the ONLY marker is a private
// `@seed.baloo.life` email (never shown in the UI), which is also the wipe-key before launch.
//
// Idempotent: re-running PURGES the previous seed (by that email marker) and recreates it cleanly.
// Purge deletes each curator's lists explicitly first — deleting a profile only NULLs list.owner_id
// (migration 0008), it doesn't remove the list.
//
// Run: npm run db:seed-community
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.development.local" });

import { eq, inArray } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { db } from "../lib/db";
import { comments, lists, products, profiles, saves, votes } from "../lib/db/schema";
import { upsertProfile } from "../lib/db/queries/profiles";
import { addListItem, createList, getListBySlug } from "../lib/db/queries/lists";

const SEED_DOMAIN = "@seed.baloo.life"; // private marker on the auth email; never surfaced in the UI
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

// Curators — read as real users. Email is the only (private) marker.
const CURATORS = [
  { email: `nuria${SEED_DOMAIN}`, handle: "nuriacocina", displayName: "Núria Mestre", bio: "Mercadona hauls and the everyday Spanish staples I actually rebuy." },
  { email: `tom${SEED_DOMAIN}`, handle: "tomreadslabels", displayName: "Tom Hedley", bio: "UK pantry, label-reader, coffee at home." },
  { email: `lena${SEED_DOMAIN}`, handle: "lenasnacks", displayName: "Lena Kowalska", bio: "Snacks, sweets, and the occasional guilt-free swap." },
  { email: `marco${SEED_DOMAIN}`, handle: "marcocooks", displayName: "Marco Ferri", bio: "Weeknight dinners without the mystery ingredients." },
];

// owner = index into CURATORS. Slugs read like real lists (no seed marker).
const LISTS = [
  { owner: 0, title: "Spanish pantry staples", slug: "spanish-pantry-staples", description: "The things always in my kitchen — hummus, gazpacho, olive-oil everything.", n: 6, hot: true },
  { owner: 0, title: "Cold lunches, no cooking", slug: "cold-lunches-no-cooking", description: "Grab-and-go, still real food.", n: 4, hot: false },
  { owner: 1, title: "Barista at home", slug: "barista-at-home", description: "Oat drinks that actually foam, and what's in them.", n: 4, hot: true },
  { owner: 1, title: "UK cupboard basics", slug: "uk-cupboard-basics", description: "Everyday shelf staples, ingredient by ingredient.", n: 5, hot: false },
  { owner: 2, title: "Movie-night snacks", slug: "movie-night-snacks", description: "The good stuff — and honestly what's in it.", n: 6, hot: true },
  { owner: 2, title: "Sweet tooth, read the label", slug: "sweet-tooth-read-the-label", description: "Spreads and treats, no judgement, just the facts.", n: 4, hot: false },
  { owner: 3, title: "Weeknight dinners", slug: "weeknight-dinners", description: "Fast dinners I trust, broken down.", n: 5, hot: false },
  { owner: 3, title: "Kids' favourites, decoded", slug: "kids-favourites-decoded", description: "What my kids ask for, explained plainly.", n: 4, hot: true },
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
    console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to manage seed users.");
    process.exit(1);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: userList, error: luErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (luErr) throw luErr;

  // 0 · PURGE any prior seed batch — the new @seed.baloo.life marker AND the old demo-* one, so this
  // cleans up the earlier "demo" accounts too. Delete lists first (owner-delete only nulls owner_id).
  const isSeedEmail = (e?: string) =>
    !!e && (e.endsWith(SEED_DOMAIN) || (e.startsWith("demo-") && e.endsWith("@baloo.life")));
  const stale = userList.users.filter((u) => isSeedEmail(u.email));
  if (stale.length) {
    const ids = stale.map((u) => u.id);
    await dbi.delete(lists).where(inArray(lists.ownerId, ids)); // cascades list_items + list comments/saves
    await dbi.delete(profiles).where(inArray(profiles.id, ids));
    for (const u of stale) await admin.auth.admin.deleteUser(u.id).catch(() => {});
    console.log(`purged ${stale.length} prior seed account(s)`);
  }

  // 1 · curators (fresh auth user + profile)
  const ids: string[] = [];
  for (const c of CURATORS) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: c.email,
      password: `s${Math.random().toString(36).slice(2)}A1!`,
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error("createUser returned no user");
    await upsertProfile(dbi, { id: created.user.id, handle: c.handle, displayName: c.displayName, bio: c.bio });
    ids.push(created.user.id);
    console.log("curator:", c.handle);
  }

  // 2 · a pool of real catalog products to build lists from
  const pool = await dbi.select({ id: products.id, name: products.name }).from(products).limit(60);
  if (pool.length < 4) {
    console.error("Not enough catalog products to seed lists.");
    process.exit(1);
  }
  let cursor = 0;
  const nextProducts = (n: number) => Array.from({ length: n }, () => pool[cursor++ % pool.length]);

  // 3 · lists + cross-engagement, timed so week/month/all-time differ ("hot" = recent activity).
  for (let li = 0; li < LISTS.length; li++) {
    const spec = LISTS[li];
    if (await getListBySlug(dbi, spec.slug)) {
      console.log("exists, skipping:", spec.slug);
      continue;
    }
    const list = await createList(dbi, {
      ownerId: ids[spec.owner],
      title: spec.title,
      slug: spec.slug,
      description: spec.description,
      isPublic: true,
    });
    for (const p of nextProducts(spec.n)) await addListItem(dbi, list.id, p.id);

    const others = ids.filter((_, idx) => idx !== spec.owner);
    const base = spec.hot ? 2 : 25; // days-ago anchor
    await dbi
      .insert(votes)
      .values(others.map((uid, k) => ({ userId: uid, targetType: "list" as const, targetId: list.id, value: 1, createdAt: daysAgo(base + k) })))
      .onConflictDoNothing();
    await dbi
      .insert(saves)
      .values(others.slice(0, spec.hot ? 3 : 1).map((uid, k) => ({ userId: uid, listId: list.id, createdAt: daysAgo(base + k + 1) })))
      .onConflictDoNothing();
    const [top] = await dbi
      .insert(comments)
      .values({ userId: others[0], listId: list.id, body: COMMENTS[li % COMMENTS.length], createdAt: daysAgo(base) })
      .returning({ id: comments.id });
    if (others[1])
      await dbi.insert(comments).values({ userId: others[1], listId: list.id, body: REPLIES[li % REPLIES.length], parentId: top.id, createdAt: daysAgo(Math.max(0, base - 1)) });
    if (spec.hot && others[2])
      await dbi.insert(comments).values({ userId: others[2], listId: list.id, body: COMMENTS[(li + 3) % COMMENTS.length], createdAt: daysAgo(1) });
    console.log("list:", spec.slug, `(${spec.n} products, ${spec.hot ? "hot" : "older"})`);
  }

  console.log(`\nSEED COMMUNITY OK — ${CURATORS.length} curators, ${LISTS.length} lists.`);
  console.log(`Wipe before launch: rerun-safe, or delete auth users whose email ends '${SEED_DOMAIN}' (delete their lists first, then profiles).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("SEED COMMUNITY FAILED:", err);
  process.exit(1);
});
