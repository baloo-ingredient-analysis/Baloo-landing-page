CREATE TYPE "public"."ingredient_origin" AS ENUM('natural', 'artificial', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."ingredient_processed" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
ALTER TABLE "ingredient_profile_items" ADD COLUMN "origin" "ingredient_origin";--> statement-breakpoint
ALTER TABLE "ingredient_profile_items" ADD COLUMN "processed" "ingredient_processed";--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "origin" "ingredient_origin";--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "processed" "ingredient_processed";