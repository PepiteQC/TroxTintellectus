CREATE TYPE "public"."character_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."item_owner_type" AS ENUM('character', 'vehicle', 'property', 'gang');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('house', 'hotel_room', 'business', 'warehouse', 'garage');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('citizen', 'mod', 'admin', 'owner');--> statement-breakpoint
CREATE TABLE "characters" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"first_name" varchar(32) NOT NULL,
	"last_name" varchar(32) NOT NULL,
	"gender" character_gender DEFAULT 'male' NOT NULL,
	"phone_number" varchar(20),
	"job" varchar(32) DEFAULT 'civil' NOT NULL,
	"gang_id" varchar(64),
	"cash" integer DEFAULT 500 NOT NULL,
	"bank" integer DEFAULT 2500 NOT NULL,
	"dirty_money" integer DEFAULT 0 NOT NULL,
	"health" integer DEFAULT 100 NOT NULL,
	"armor" integer DEFAULT 0 NOT NULL,
	"hunger" integer DEFAULT 100 NOT NULL,
	"thirst" integer DEFAULT 100 NOT NULL,
	"stress" integer DEFAULT 0 NOT NULL,
	"is_dead" boolean DEFAULT false NOT NULL,
	"wanted_level" integer DEFAULT 0 NOT NULL,
	"is_handcuffed" boolean DEFAULT false NOT NULL,
	"in_jail_until" timestamp with time zone,
	"pos_x" real DEFAULT 0 NOT NULL,
	"pos_y" real DEFAULT 1 NOT NULL,
	"pos_z" real DEFAULT 10 NOT NULL,
	"rotation" real DEFAULT 0 NOT NULL,
	"current_zone" varchar(64) DEFAULT 'Portneuf' NOT NULL,
	"interior_id" varchar(64),
	"appearance" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "employments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64),
	"job_id" varchar(64),
	"hired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fired_at" timestamp with time zone,
	"salary" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_logs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64),
	"event" varchar(64) NOT NULL,
	"details" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gangs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"color" varchar(16) DEFAULT '#FFFFFF' NOT NULL,
	"leader_id" varchar(64),
	"reputation" integer DEFAULT 0 NOT NULL,
	"treasury" integer DEFAULT 0 NOT NULL,
	"is_business" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gangs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "illicit_productions" (
	"id" serial PRIMARY KEY NOT NULL,
	"stash_id" integer NOT NULL,
	"product_type" text NOT NULL,
	"current_volume" real DEFAULT 0 NOT NULL,
	"max_capacity" real DEFAULT 100 NOT NULL,
	"production_rate" real DEFAULT 1.5 NOT NULL,
	"is_raidable" boolean DEFAULT true NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_type" "item_owner_type" NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"item_name" varchar(128) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"slot" integer,
	"weight" real DEFAULT 0 NOT NULL,
	"durability" integer DEFAULT 100 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jail_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"officer_id" text NOT NULL,
	"reason" text NOT NULL,
	"bail_amount" integer DEFAULT 500 NOT NULL,
	"sentence_duration_minutes" integer DEFAULT 15 NOT NULL,
	"is_jailed" boolean DEFAULT true NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"base_salary" integer DEFAULT 0 NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_contacts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"number" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_messages" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"sender_id" varchar(64) NOT NULL,
	"receiver_number" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_constraints" (
	"player_id" text PRIMARY KEY NOT NULL,
	"is_handcuffed" boolean DEFAULT false NOT NULL,
	"is_escorted" boolean DEFAULT false NOT NULL,
	"escorted_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "police_raids" (
	"id" serial PRIMARY KEY NOT NULL,
	"stash_id" integer NOT NULL,
	"officer_id" text NOT NULL,
	"confiscated_goods" text NOT NULL,
	"fines_issued" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "police_tickets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64) NOT NULL,
	"article" varchar(64) NOT NULL,
	"fine" integer NOT NULL,
	"officer_badge" varchar(32) NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "property_type" DEFAULT 'house' NOT NULL,
	"price" integer NOT NULL,
	"owner_id" varchar(64),
	"locked" boolean DEFAULT true NOT NULL,
	"has_desk_phone" boolean DEFAULT false NOT NULL,
	"desk_phone_ext" varchar(10),
	"pos_x" real NOT NULL,
	"pos_y" real NOT NULL,
	"pos_z" real NOT NULL,
	"interior_template" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stash_houses" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"x" real NOT NULL,
	"z" real NOT NULL,
	"zone_name" text NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"upgrade_level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"amount" integer NOT NULL,
	"account" varchar(32) DEFAULT 'bank' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"role" "user_role" DEFAULT 'citizen' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_id" varchar(64),
	"model" varchar(64) NOT NULL,
	"plate" varchar(16) NOT NULL,
	"primary_color" varchar(32) DEFAULT '#c0c0c0' NOT NULL,
	"mods" jsonb DEFAULT '{}'::jsonb,
	"fuel" real DEFAULT 100 NOT NULL,
	"engine_health" real DEFAULT 1000 NOT NULL,
	"body_health" real DEFAULT 1000 NOT NULL,
	"mileage_km" real DEFAULT 0 NOT NULL,
	"locked" boolean DEFAULT true NOT NULL,
	"is_impounded" boolean DEFAULT false NOT NULL,
	"garage_id" varchar(64),
	"pos_x" real,
	"pos_y" real,
	"pos_z" real,
	"rotation" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
CREATE TABLE "weapons" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64),
	"model" varchar(64) NOT NULL,
	"serial_number" varchar(32),
	"ammo" integer DEFAULT 0 NOT NULL,
	"durability" integer DEFAULT 100 NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weapons_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_gang_id_gangs_id_fk" FOREIGN KEY ("gang_id") REFERENCES "public"."gangs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employments" ADD CONSTRAINT "employments_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employments" ADD CONSTRAINT "employments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illicit_productions" ADD CONSTRAINT "illicit_productions_stash_id_stash_houses_id_fk" FOREIGN KEY ("stash_id") REFERENCES "public"."stash_houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_contacts" ADD CONSTRAINT "phone_contacts_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_messages" ADD CONSTRAINT "phone_messages_sender_id_characters_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "police_raids" ADD CONSTRAINT "police_raids_stash_id_stash_houses_id_fk" FOREIGN KEY ("stash_id") REFERENCES "public"."stash_houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "police_tickets" ADD CONSTRAINT "police_tickets_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_characters_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_characters_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weapons" ADD CONSTRAINT "weapons_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chars_user" ON "characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chars_name" ON "characters" USING btree ("first_name","last_name");--> statement-breakpoint
CREATE INDEX "idx_chars_phone" ON "characters" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "idx_employments_character" ON "employments" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_employments_job" ON "employments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_logs_character" ON "game_logs" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_logs_event" ON "game_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "idx_inventory_owner" ON "inventory_items" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "idx_props_owner" ON "properties" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_tx_character" ON "transactions" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_name" ON "users" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vehicles_plate" ON "vehicles" USING btree ("plate");--> statement-breakpoint
CREATE INDEX "idx_vehicles_owner" ON "vehicles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_vehicles_garage" ON "vehicles" USING btree ("garage_id");--> statement-breakpoint
CREATE INDEX "idx_weapons_character" ON "weapons" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_weapons_serial" ON "weapons" USING btree ("serial_number");