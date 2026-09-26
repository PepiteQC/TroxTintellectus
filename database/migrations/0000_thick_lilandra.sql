CREATE TYPE "public"."account_kind" AS ENUM('cash', 'bank', 'dirty');--> statement-breakpoint
CREATE TYPE "public"."character_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."item_owner_type" AS ENUM('character', 'vehicle', 'property', 'gang', 'ground');--> statement-breakpoint
CREATE TYPE "public"."key_target_type" AS ENUM('property', 'vehicle');--> statement-breakpoint
CREATE TYPE "public"."license_type" AS ENUM('conduire', 'arme', 'chasse', 'peche', 'bateau', 'avion', 'commerce');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('maison', 'appartement', 'commerce', 'entrepot', 'garage', 'ferme', 'chalet', 'hotel_room', 'business', 'warehouse');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('player', 'citizen', 'mod', 'moderator', 'admin', 'owner');--> statement-breakpoint
CREATE TYPE "public"."world_state_type" AS ENUM('door', 'container');--> statement-breakpoint
CREATE TABLE "access_keys" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64) NOT NULL,
	"target_type" "key_target_type" NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"granted_by" varchar(64),
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"first_name" varchar(32) NOT NULL,
	"last_name" varchar(32) NOT NULL,
	"gender" character_gender DEFAULT 'male' NOT NULL,
	"nationality" varchar(32) DEFAULT 'Québécoise' NOT NULL,
	"phone_number" varchar(20),
	"gang_id" varchar(64),
	"gang_rank" varchar(32),
	"appearance" jsonb DEFAULT '{}'::jsonb,
	"active_aura" varchar(32),
	"cash" integer DEFAULT 500 NOT NULL,
	"bank" integer DEFAULT 2500 NOT NULL,
	"dirty_money" integer DEFAULT 0 NOT NULL,
	"bounty" integer DEFAULT 0 NOT NULL,
	"job" varchar(32) DEFAULT 'Civil' NOT NULL,
	"job_grade" integer DEFAULT 0 NOT NULL,
	"job_hours_worked" real DEFAULT 0 NOT NULL,
	"on_duty" boolean DEFAULT false NOT NULL,
	"last_paycheck_at" timestamp with time zone,
	"health" integer DEFAULT 100 NOT NULL,
	"armor" integer DEFAULT 0 NOT NULL,
	"hunger" integer DEFAULT 100 NOT NULL,
	"thirst" integer DEFAULT 100 NOT NULL,
	"stress" integer DEFAULT 0 NOT NULL,
	"is_dead" boolean DEFAULT false NOT NULL,
	"is_cuffed" boolean DEFAULT false NOT NULL,
	"in_jail_until" timestamp with time zone,
	"wanted_level" integer DEFAULT 0 NOT NULL,
	"pos_x" real DEFAULT 0 NOT NULL,
	"pos_y" real DEFAULT 1 NOT NULL,
	"pos_z" real DEFAULT 10 NOT NULL,
	"rotation" real DEFAULT 0 NOT NULL,
	"current_zone" varchar(64) DEFAULT 'Portneuf' NOT NULL,
	"interior_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"playtime_seconds" integer DEFAULT 0 NOT NULL,
	"spawn_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "characters_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "criminal_records" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64) NOT NULL,
	"offense" text NOT NULL,
	"description" text,
	"fine" integer DEFAULT 0 NOT NULL,
	"jail_minutes" integer DEFAULT 0 NOT NULL,
	"officer_id" varchar(64),
	"officer_name" varchar(128),
	"village_name" varchar(64),
	"paid" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"disconnect_reason" text,
	"last_snapshot" jsonb
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
CREATE TABLE "inventory_items" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_type" "item_owner_type" NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"item_name" varchar(128) NOT NULL,
	"category" varchar(32) DEFAULT 'misc' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"slot" integer,
	"weight" real DEFAULT 0 NOT NULL,
	"durability" integer DEFAULT 100 NOT NULL,
	"serial_number" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64) NOT NULL,
	"license_type" "license_type" NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"points" integer DEFAULT 0 NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"suspended_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"address" varchar(255) DEFAULT '' NOT NULL,
	"village_name" varchar(64) DEFAULT 'Portneuf' NOT NULL,
	"property_type" "property_type" DEFAULT 'maison' NOT NULL,
	"owner_id" varchar(64),
	"owner_type" varchar(32) DEFAULT 'state' NOT NULL,
	"price" integer NOT NULL,
	"for_sale" boolean DEFAULT true NOT NULL,
	"rent_per_day" integer,
	"tax_per_week" integer DEFAULT 0 NOT NULL,
	"tax_due_at" timestamp with time zone,
	"locked" boolean DEFAULT true NOT NULL,
	"has_alarm" boolean DEFAULT false NOT NULL,
	"condition" integer DEFAULT 100 NOT NULL,
	"last_robbed_at" timestamp with time zone,
	"bedrooms" integer DEFAULT 2 NOT NULL,
	"garage_slots" integer DEFAULT 0 NOT NULL,
	"storage_capacity" real DEFAULT 50 NOT NULL,
	"has_desk_phone" boolean DEFAULT false NOT NULL,
	"desk_phone_ext" varchar(10),
	"pos_x" real NOT NULL,
	"pos_y" real NOT NULL,
	"pos_z" real NOT NULL,
	"entrance_x" real,
	"entrance_y" real,
	"entrance_z" real,
	"interior_template" varchar(64) DEFAULT 'default_house',
	"purchased_at" timestamp with time zone,
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
CREATE TABLE "transactions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"character_id" varchar(64),
	"type" varchar(32) NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer DEFAULT 0 NOT NULL,
	"account" "account_kind" DEFAULT 'bank' NOT NULL,
	"counterparty_id" varchar(64),
	"description" text,
	"village_name" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"password_hash" varchar(255),
	"role" "user_role" DEFAULT 'player' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires_at" timestamp with time zone,
	"trust_score" integer DEFAULT 100 NOT NULL,
	"total_playtime_seconds" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_id" varchar(64),
	"owner_type" varchar(32) DEFAULT 'character' NOT NULL,
	"model" varchar(64) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"plate" varchar(16) NOT NULL,
	"vin" varchar(32) NOT NULL,
	"primary_color" varchar(32) DEFAULT '#c0c0c0' NOT NULL,
	"secondary_color" varchar(32),
	"mods" jsonb DEFAULT '{}'::jsonb,
	"fuel" real DEFAULT 100 NOT NULL,
	"engine_health" real DEFAULT 100 NOT NULL,
	"body_health" real DEFAULT 100 NOT NULL,
	"mileage_km" real DEFAULT 0 NOT NULL,
	"locked" boolean DEFAULT true NOT NULL,
	"is_stored" boolean DEFAULT true NOT NULL,
	"is_impounded" boolean DEFAULT false NOT NULL,
	"impound_fee" integer DEFAULT 0 NOT NULL,
	"is_stolen" boolean DEFAULT false NOT NULL,
	"garage_id" varchar(64),
	"pos_x" real,
	"pos_y" real,
	"pos_z" real,
	"rotation" real,
	"insurance_expires_at" timestamp with time zone,
	"registration_expires_at" timestamp with time zone,
	"purchase_price" integer,
	"purchased_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate"),
	CONSTRAINT "vehicles_vin_unique" UNIQUE("vin")
);
--> statement-breakpoint
CREATE TABLE "world_state" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"state_type" "world_state_type" NOT NULL,
	"village_name" varchar(64),
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"respawn_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_keys" ADD CONSTRAINT "access_keys_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_gang_id_gangs_id_fk" FOREIGN KEY ("gang_id") REFERENCES "public"."gangs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criminal_records" ADD CONSTRAINT "criminal_records_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_characters_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_characters_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_keys_char" ON "access_keys" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_keys_target" ON "access_keys" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_keys_unique" ON "access_keys" USING btree ("character_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_chars_user" ON "characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chars_name" ON "characters" USING btree ("first_name","last_name");--> statement-breakpoint
CREATE INDEX "idx_chars_phone" ON "characters" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "idx_chars_gang" ON "characters" USING btree ("gang_id");--> statement-breakpoint
CREATE INDEX "idx_chars_zone" ON "characters" USING btree ("current_zone");--> statement-breakpoint
CREATE INDEX "idx_rec_char" ON "criminal_records" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_rec_date" ON "criminal_records" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_gs_char" ON "game_sessions" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_inv_owner" ON "inventory_items" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "idx_inv_item" ON "inventory_items" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_inv_serial" ON "inventory_items" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "idx_lic_char" ON "licenses" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lic_unique" ON "licenses" USING btree ("character_id","license_type");--> statement-breakpoint
CREATE INDEX "idx_props_owner" ON "properties" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_props_village" ON "properties" USING btree ("village_name");--> statement-breakpoint
CREATE INDEX "idx_props_sale" ON "properties" USING btree ("for_sale");--> statement-breakpoint
CREATE INDEX "idx_tx_char" ON "transactions" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_tx_date" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tx_type" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_name" ON "users" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_veh_plate" ON "vehicles" USING btree ("plate");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_veh_vin" ON "vehicles" USING btree ("vin");--> statement-breakpoint
CREATE INDEX "idx_veh_owner" ON "vehicles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_veh_garage" ON "vehicles" USING btree ("garage_id");--> statement-breakpoint
CREATE INDEX "idx_world_type" ON "world_state" USING btree ("state_type");--> statement-breakpoint
CREATE INDEX "idx_world_village" ON "world_state" USING btree ("village_name");--> statement-breakpoint
CREATE INDEX "idx_world_respawn" ON "world_state" USING btree ("respawn_at");