ALTER TABLE "comments" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "list_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "comments" ADD CONSTRAINT "comments_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_list_idx" ON "comments" USING btree ("list_id");--> statement-breakpoint
-- A comment targets EXACTLY ONE of product / list (L-community list comments). Existing rows are all
-- product-scoped, so they already satisfy this.
DO $$ BEGIN
  ALTER TABLE "comments" ADD CONSTRAINT "comments_one_target"
    CHECK ((product_id IS NOT NULL) <> (list_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN null; END $$;
