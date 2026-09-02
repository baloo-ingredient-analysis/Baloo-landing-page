CREATE TABLE IF NOT EXISTS "handle_redirects" (
	"old_handle" text PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "handle_redirects" ADD CONSTRAINT "handle_redirects_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- RLS: handles are public, so an old→profile mapping is public too. Read-only for clients (defence
-- in depth); all writes happen server-side (Drizzle bypasses RLS) from the profile-update route.
ALTER TABLE "handle_redirects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "handle_redirects_public_read" ON "handle_redirects";--> statement-breakpoint
CREATE POLICY "handle_redirects_public_read" ON "handle_redirects" FOR SELECT USING (true);
