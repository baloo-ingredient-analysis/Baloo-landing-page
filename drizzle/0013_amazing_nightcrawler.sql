CREATE TABLE IF NOT EXISTS "list_pending_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"barcode" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"status" text DEFAULT 'analysing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "list_pending_items" ADD CONSTRAINT "list_pending_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "list_pending_items_list_barcode_uq" ON "list_pending_items" USING btree ("list_id","barcode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "list_pending_items_list_idx" ON "list_pending_items" USING btree ("list_id");--> statement-breakpoint

-- RLS (defence-in-depth for client access paths; server-side Drizzle bypasses it and the API enforces
-- ownership). Pending items are transient/internal — owner-only for every operation, never public.
ALTER TABLE "list_pending_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "list_pending_items_read_via_list" ON "list_pending_items";--> statement-breakpoint
CREATE POLICY "list_pending_items_read_via_list" ON "list_pending_items" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "lists" l WHERE l.id = list_id AND auth.uid() = l.owner_id)
);--> statement-breakpoint
DROP POLICY IF EXISTS "list_pending_items_insert_via_list" ON "list_pending_items";--> statement-breakpoint
CREATE POLICY "list_pending_items_insert_via_list" ON "list_pending_items" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "lists" l WHERE l.id = list_id AND auth.uid() = l.owner_id)
);--> statement-breakpoint
DROP POLICY IF EXISTS "list_pending_items_update_via_list" ON "list_pending_items";--> statement-breakpoint
CREATE POLICY "list_pending_items_update_via_list" ON "list_pending_items" FOR UPDATE USING (
  EXISTS (SELECT 1 FROM "lists" l WHERE l.id = list_id AND auth.uid() = l.owner_id)
);--> statement-breakpoint
DROP POLICY IF EXISTS "list_pending_items_delete_via_list" ON "list_pending_items";--> statement-breakpoint
CREATE POLICY "list_pending_items_delete_via_list" ON "list_pending_items" FOR DELETE USING (
  EXISTS (SELECT 1 FROM "lists" l WHERE l.id = list_id AND auth.uid() = l.owner_id)
);
