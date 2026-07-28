CREATE TABLE "product_saves" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_saves_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "product_saves" ADD CONSTRAINT "product_saves_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_saves" ADD CONSTRAINT "product_saves_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS (Order PP1, hand-added — Drizzle doesn't emit policies). The Pantry is PRIVATE: unlike `saves`
-- (public "saved by N"), a user's saved products are visible only to them. Server Drizzle bypasses RLS
-- (API routes enforce auth in code); these are defence-in-depth for any client/PostgREST/mobile path.
ALTER TABLE "product_saves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "product_saves_own_read" ON "product_saves" FOR SELECT USING (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "product_saves_self_insert" ON "product_saves" FOR INSERT WITH CHECK (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "product_saves_self_delete" ON "product_saves" FOR DELETE USING (auth.uid() = user_id);