CREATE TYPE "public"."permission_level" AS ENUM('citizen', 'vip', 'moderator', 'admin', 'superadmin');--> statement-breakpoint
CREATE TYPE "public"."player_state" AS ENUM('idle', 'walking', 'running', 'in_vehicle', 'cuffed', 'downed', 'dead', 'spectating');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('purchase', 'salary', 'deposit', 'withdraw', 'transfer', 'fine', 'reward', 'admin_grant');--> statement-breakpoint
CREATE TYPE "public"."vehicle_state" AS ENUM('parked', 'active', 'impounded', 'destroyed');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment', 'house', 'business', 'warehouse', 'garage');--> statement-breakpoint
CREATE TYPE "public"."gang_type" AS ENUM('gang', 'mafia', 'cartel', 'crew');--> statement-breakpoint
CREATE TYPE "public"."job_category" AS ENUM('civilian', 'emergency', 'government', 'illegal', 'freelance');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."log_type" AS ENUM('admin', 'economy', 'combat', 'vehicle', 'property', 'system', 'security', 'chat');--> statement-breakpoint
CREATE TYPE "public"."weather_type" AS ENUM('sunny', 'cloudy', 'rainy', 'stormy', 'foggy', 'snowy');--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"permission" "permission_level" DEFAULT 'citizen' NOT NULL,
	"health" integer DEFAULT 100 NOT NULL,
	"armor" integer DEFAULT 0 NOT NULL,
	"hunger" integer DEFAULT 100 NOT NULL,
	"thirst" integer DEFAULT 100 NOT NULL,
	"position_x" real DEFAULT 0 NOT NULL,
	"position_y" real DEFAULT 0 NOT NULL,
	"position_z" real DEFAULT 0 NOT NULL,
	"heading" real DEFAULT 0 NOT NULL,
	"job" text DEFAULT 'civilian' NOT NULL,
	"job_rank" integer DEFAULT 1 NOT NULL,
	"gang_id" text,
	"dimension_id" text DEFAULT 'root' NOT NULL,
	"inventory" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" "player_state" DEFAULT 'idle' NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"cash" bigint DEFAULT 0 NOT NULL,
	"bank" bigint DEFAULT 0 NOT NULL,
	"debt" bigint DEFAULT 0 NOT NULL,
	"frozen" text DEFAULT 'no' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text,
	"type" "transaction_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance" bigint NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"model" text NOT NULL,
	"plate" text NOT NULL,
	"color" text DEFAULT '#ffffff' NOT NULL,
	"position_x" real DEFAULT 0 NOT NULL,
	"position_y" real DEFAULT 0 NOT NULL,
	"position_z" real DEFAULT 0 NOT NULL,
	"heading" real DEFAULT 0 NOT NULL,
	"state" "vehicle_state" DEFAULT 'parked' NOT NULL,
	"fuel" integer DEFAULT 100 NOT NULL,
	"mileage" real DEFAULT 0 NOT NULL,
	"locked" boolean DEFAULT true NOT NULL,
	"mods" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"type" "property_type" NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"position_x" real NOT NULL,
	"position_y" real NOT NULL,
	"position_z" real NOT NULL,
	"interior_id" text,
	"locked" boolean DEFAULT true NOT NULL,
	"for_sale" boolean DEFAULT true NOT NULL,
	"rent_price" integer DEFAULT 0 NOT NULL,
	"storage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gang_members" (
	"player_id" text NOT NULL,
	"gang_id" text NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gangs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "gang_type" DEFAULT 'gang' NOT NULL,
	"leader_id" text NOT NULL,
	"color" text DEFAULT '#ff0000' NOT NULL,
	"territory" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"reputation" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gangs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "job_category" DEFAULT 'civilian' NOT NULL,
	"color" text DEFAULT '#ffffff' NOT NULL,
	"max_players" integer DEFAULT 20 NOT NULL,
	"base_salary" integer DEFAULT 0 NOT NULL,
	"illegal" boolean DEFAULT false NOT NULL,
	"grades" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "log_type" NOT NULL,
	"level" "log_level" DEFAULT 'INFO' NOT NULL,
	"actor_id" text,
	"target_id" text,
	"action" text NOT NULL,
	"reason" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_props" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"placed_by" text,
	"position_x" real NOT NULL,
	"position_y" real NOT NULL,
	"position_z" real NOT NULL,
	"rotation" real DEFAULT 0 NOT NULL,
	"scale" real DEFAULT 1 NOT NULL,
	"permanent" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_state" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"weather" "weather_type" DEFAULT 'sunny' NOT NULL,
	"time_hours" real DEFAULT 12 NOT NULL,
	"season" text DEFAULT 'summer' NOT NULL,
	"day_count" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "players_job_idx" ON "players" USING btree ("job");--> statement-breakpoint
CREATE INDEX "players_gang_idx" ON "players" USING btree ("gang_id");--> statement-breakpoint
CREATE INDEX "players_online_idx" ON "players" USING btree ("is_online");--> statement-breakpoint
CREATE INDEX "tx_from_idx" ON "transactions" USING btree ("from_id");--> statement-breakpoint
CREATE INDEX "tx_to_idx" ON "transactions" USING btree ("to_id");--> statement-breakpoint
CREATE INDEX "tx_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tx_date_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "vehicles_owner_idx" ON "vehicles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "vehicles_state_idx" ON "vehicles" USING btree ("state");--> statement-breakpoint
CREATE INDEX "vehicles_plate_idx" ON "vehicles" USING btree ("plate");--> statement-breakpoint
CREATE INDEX "props_owner_idx" ON "properties" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "props_type_idx" ON "properties" USING btree ("type");--> statement-breakpoint
CREATE INDEX "props_sale_idx" ON "properties" USING btree ("for_sale");--> statement-breakpoint
CREATE INDEX "gm_player_idx" ON "gang_members" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "gm_gang_idx" ON "gang_members" USING btree ("gang_id");--> statement-breakpoint
CREATE INDEX "logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "logs_type_idx" ON "audit_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "logs_level_idx" ON "audit_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "logs_date_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "world_props_type_idx" ON "world_props" USING btree ("type");--> statement-breakpoint
CREATE INDEX "world_props_placer_idx" ON "world_props" USING btree ("placed_by");