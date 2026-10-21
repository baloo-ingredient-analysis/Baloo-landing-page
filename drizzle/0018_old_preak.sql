DO $$ BEGIN
 CREATE TYPE "public"."ingredient_origin" AS ENUM('natural', 'artificial', 'unknown');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ingredient_processed" AS ENUM('yes', 'no', 'unknown');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TABLE "ingredient_profile_items" ADD COLUMN IF NOT EXISTS "origin" "ingredient_origin";--> statement-breakpoint
ALTER TABLE "ingredient_profile_items" ADD COLUMN IF NOT EXISTS "processed" "ingredient_processed";--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "origin" "ingredient_origin";--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "processed" "ingredient_processed";
