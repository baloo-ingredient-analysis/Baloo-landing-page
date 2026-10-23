ALTER TABLE "lists" ADD COLUMN "hero_url" text;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "hero_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hero_generated_at" timestamp with time zone;