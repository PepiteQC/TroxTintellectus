import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "path";

// Chargement cohérent des environnements pour Drizzle Kit
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig({
  schema: "./client/src/db/schema.ts",
  out: "./database/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/troxt_db",
  },
  verbose: true,
  strict: true,
});