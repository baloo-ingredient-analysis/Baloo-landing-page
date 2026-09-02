// Phase 3 data model (Order G1) — the Part-II schema from Baloo_Phase3_Full_Build_Guide.md.
// Drizzle tables for Supabase Postgres. This file is the source of truth; migrations are
// generated from it (npm run db:generate). The Zod AI shapes stay in lib/schema.ts — the two
// deliberately don't merge: this is storage, that is model I/O.
//
// Conventions:
// - uuid PKs default gen_random_uuid(); created_at timestamptz default now().
// - pgEnum only for the stable discriminators (tag, per). Evolving ones (source, verb,
//   target_type, status) are text + exported TS unions — Postgres enum migrations are painful
//   and these sets will grow.
// - profiles.id will equal auth.users.id from G2 onward; the FK to auth.users is added by a G2
//   migration (the auth schema doesn't exist until Supabase Auth is wired), which keeps G1
//   seedable and self-contained.

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { Nutrient } from "../schema";

// ── Stable enums ──────────────────────────────────────────────────────────────────────────────
export const tagEnum = pgEnum("ingredient_tag", ["Natural", "Processed"]);
export const perEnum = pgEnum("nutrition_per", ["100g", "serving", "both"]);
// Analysis lifecycle (Order P1): 'done' the moment a product's canonical analysis exists; 'pending'
// / 'analysing' while a background job (P2) is resolving a product added to a list; 'failed' retries.
export const analysisStatusEnum = pgEnum("analysis_status", [
  "pending",
  "analysing",
  "done",
  "failed",
]);

// ── Evolving discriminators (text columns + TS unions) ───────────────────────────────────────
export type ProductSource = "user_scan" | "open_food_facts" | "go_upc";
export type VoteTargetType = "list" | "product" | "comment";
export type ActivityVerb =
  | "created_list"
  | "added_item"
  | "voted"
  | "commented"
  | "followed"
  | "scanned";
export type ReportTargetType = "list" | "product" | "comment" | "profile";
export type ReportStatus = "open" | "reviewed" | "actioned";

// ── Identity ──────────────────────────────────────────────────────────────────────────────────
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  // Moderation privilege (Order G9). Set via scripts/make-admin.ts; gates /admin + /api/moderation.
  isAdmin: boolean("is_admin").notNull().default(false),
  // In-app notifications (N1): the moment the owner last opened their notifications. Anything newer
  // (a follow, a like/save on their list) counts as unread. A single marker — no per-row read state.
  notificationsSeenAt: timestamp("notifications_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Catalog (canonical products + versioned analysis) ────────────────────────────────────────
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // THE dedup invariant: barcode when known, else normalised brand+name+size hash.
    // Ingestion upserts on this key so everyone converges on one row per real-world product.
    canonicalKey: text("canonical_key").notNull().unique(),
    slug: text("slug").notNull().unique(), // /p/[slug]
    name: text("name").notNull(),
    brand: text("brand"),
    retailer: text("retailer"),
    barcode: text("barcode"),
    imageUrl: text("image_url"),
    source: text("source").$type<ProductSource>().notNull().default("user_scan"),
    // Analysis lifecycle (Order P1). Default 'done': every existing row reached the catalog via a
    // completed ingest. P2's background job flips new-to-Baloo products pending→analysing→done.
    analysisStatus: analysisStatusEnum("analysis_status").notNull().default("done"),
    analysedAt: timestamp("analysed_at", { withTimezone: true }),
    category: text("category"), // OFF/H1 taxonomy later; readies /c/[category]
    // Sales markets (OFF countries_tags, humanised: "spain", "united kingdom"). The beta serves ES/UK
    // only, so search hides products whose market is known and NOT one of those (a Finnish-market Coke
    // never surfaces). NULL/empty = unknown (e.g. a user scan) → not hidden. Filled from OFF at ingest.
    countries: text("countries").array(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Semantic search (SS1): OpenAI text-embedding-3-small vector of brand+name+summary+ingredients.
    // Nullable — filled on ingest / by the backfill script; NULL rows just don't match semantic
    // queries (keyword search still covers them). pgvector; see drizzle/0010 + lib/embeddings.ts.
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (t) => [
    index("products_barcode_idx").on(t.barcode),
    // HNSW + cosine distance for fast nearest-neighbour against the query embedding.
    index("products_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

// Offers (Order P1): a retailer's listing of a product. Two retailer listings of the same barcode
// are TWO offers on ONE product — this is the whole point of the Product/Offer split (dedup +
// "also available at", P4). price/currency/priceAt exist but stay NULL in v1 (no pricing yet; an
// affiliate future would live here, behind visible disclosure).
export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    retailer: text("retailer"),
    url: text("url"),
    available: boolean("available").notNull().default(true),
    price: numeric("price"),
    currency: text("currency"),
    priceAt: timestamp("price_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("offers_product_retailer_url_uq").on(t.productId, t.retailer, t.url),
    index("offers_product_idx").on(t.productId),
  ],
);

export const ingredientProfiles = pgTable(
  "ingredient_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // Exactly one active version per product; old versions are superseded, never deleted.
    isActive: boolean("is_active").notNull().default(true),
    // The F1 product_summary — one neutral sentence about the formulation, versioned with it.
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ingredient_profiles_product_version_uq").on(t.productId, t.version),
    index("ingredient_profiles_product_idx").on(t.productId),
  ],
);

export const ingredientProfileItems = pgTable(
  "ingredient_profile_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => ingredientProfiles.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(), // label order — absolute, never re-sorted
    name: text("name").notNull(),
    percent: text("percent"), // as printed ("10%")
    role: text("role"), // Order F1 functional label; null for pre-F1/seeded data
    tag: tagEnum("tag"),
    whyItsHere: text("why_its_here"), // product-SPECIFIC (general what_it_is lives on ingredients)
    percentageNote: text("percentage_note"),
  },
  (t) => [
    uniqueIndex("ingredient_profile_items_profile_rank_uq").on(t.profileId, t.rank),
    index("ingredient_profile_items_profile_idx").on(t.profileId),
  ],
);

// The canonical ingredient dictionary + product-INDEPENDENT AI cache (brief §4.1):
// what_it_is is generated once per ingredient and reused across every product containing it.
export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalName: text("canonical_name").notNull().unique(),
  aliases: text("aliases").array().notNull().default([]),
  tag: tagEnum("tag"),
  whatItIs: text("what_it_is"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nutrition = pgTable("nutrition", {
  productId: uuid("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  servingSize: text("serving_size"),
  per: perEnum("per").notNull().default("100g"),
  nutrients: jsonb("nutrients").$type<Nutrient[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Lists (the primary object) ────────────────────────────────────────────────────────────────
export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable + SET NULL (Order S7a): when a curator deletes their account we ERASE THE PERSON but
    // KEEP THE COMMUNITY — their public lists survive, ownerless, and render "by a Baloo user".
    // Cascade here would have hard-deleted every list they ever made and 404'd every shared link.
    // Security note: `owner_id = auth.uid()` is never true for NULL, so an orphaned list is
    // editable by nobody — the RLS policies need no change.
    ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(), // /list/[slug]
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    coverUrl: text("cover_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Semantic search over public lists (L3): OpenAI embedding of title + description. Filled on
    // create/update and by the backfill; NULL rows just don't match semantic queries (keyword still
    // covers them). Same optional-infra rule as products.embedding.
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (t) => [
    index("lists_owner_idx").on(t.ownerId),
    index("lists_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const listItems = pgTable(
  "list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    note: text("note"), // curator's note ("great for lunchboxes")
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("list_items_list_product_uq").on(t.listId, t.productId),
    index("list_items_list_position_idx").on(t.listId, t.position),
    index("list_items_product_idx").on(t.productId),
  ],
);

// Pending list items (P3): an Open Food Facts pick the owner added that is still being analysed
// (analyse-and-add takes a Claude pass, ~a minute). Kept in a SEPARATE table so `list_items` — and
// every count/join/reorder path built on it — stays exactly as before: a pending row is never a real
// item, never public, never counted. On success the owner's editor adds the real `list_items` row and
// deletes this one; on failure it flips to 'failed' (retry/dismiss). Persisted so an in-flight analysis
// survives a reload (the editor resumes 'analysing' rows on mount). Owner-only (RLS + API).
export const listPendingItems = pgTable(
  "list_pending_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    barcode: text("barcode").notNull(), // the OFF barcode being analysed (natural key within a list)
    name: text("name").notNull(), // display label while it resolves
    brand: text("brand"),
    status: text("status").notNull().default("analysing"), // 'analysing' | 'failed'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("list_pending_items_list_barcode_uq").on(t.listId, t.barcode),
    index("list_pending_items_list_idx").on(t.listId),
  ],
);

// ── Social graph & engagement ────────────────────────────────────────────────────────────────
export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })],
);

export const saves = pgTable(
  "saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listId] })],
);

// The Pantry (Order PP1): a private collection of SAVED PRODUCTS — distinct from `saves` above, which
// saves LISTS. Composite PK so a product is saved at most once per user; both FKs cascade so account
// or product deletion cleans up. PRIVATE by design — its RLS is owner-only read (unlike `saves`, which
// is public for "saved by N"), so no one can see another person's pantry.
export const productSaves = pgTable(
  "product_saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    targetType: text("target_type").$type<VoteTargetType>().notNull(),
    targetId: uuid("target_id").notNull(),
    value: integer("value").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("votes_user_target_uq").on(t.userId, t.targetType, t.targetId)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable + SET NULL (Order S7a). Cascade here was a trap: because `parentId` below also
    // cascades, deleting an account would have deleted that person's comments AND every reply
    // OTHER people wrote underneath them. Now the row survives as a scrubbed tombstone (body
    // cleared, hiddenBy 'author'), the thread tree stays intact, and the personal data is gone.
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    // Soft moderation (Order G9): non-null = removed. hiddenBy distinguishes an author's own
    // delete from a moderator action. Nothing is hard-deleted — reversible + auditable, and it
    // keeps the thread tree intact (hidden nodes render as a tombstone so replies aren't orphaned).
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    hiddenBy: text("hidden_by").$type<"author" | "moderator">(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_product_idx").on(t.productId)],
);

// The event log: powers the home feed (G6) and the graduated "on Baloo right now" board.
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    verb: text("verb").$type<ActivityVerb>().notNull(),
    objectType: text("object_type").notNull(),
    objectId: uuid("object_id").notNull(),
    // Sidecar detail (G6): e.g. added_item keeps objectId = the list but records WHICH product
    // here, so the feed's receipt panel can name it. Nullable — pre-G6 rows render count-only.
    meta: jsonb("meta").$type<{ productId?: string }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_created_idx").on(t.createdAt),
    index("activity_actor_idx").on(t.actorId),
  ],
);

// ── Trust & safety ────────────────────────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  targetType: text("target_type").$type<ReportTargetType>().notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").$type<ReportStatus>().notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Row types for consumers (G2–G9 build against these, never raw SQL).
export type Profile = typeof profiles.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type IngredientProfile = typeof ingredientProfiles.$inferSelect;
export type IngredientProfileItem = typeof ingredientProfileItems.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type NutritionRow = typeof nutrition.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
export type ListPendingItem = typeof listPendingItems.$inferSelect;
export type ProductSave = typeof productSaves.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type AnalysisStatus = (typeof analysisStatusEnum.enumValues)[number];
