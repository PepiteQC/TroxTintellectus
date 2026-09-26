// scripts\create-database.mjs
//
// Crée la base de données cible si elle n'existe pas.
// Usage : node scripts/create-database.mjs
//         node scripts/create-database.mjs --env=.env.development
//

import { Client } from "pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// ─── Chargement de l'env ────────────────────────────────────────────
const envArg = process.argv.find((a) => a.startsWith("--env="));
const envFile = envArg ? envArg.split("=")[1] : ".env";
loadEnv({ path: resolve(process.cwd(), envFile) });

// ─── Config ─────────────────────────────────────────────────────────
const CONNECT_TIMEOUT_MS = 5_000;
const QUERY_TIMEOUT_MS = 10_000;

// ─── Helpers ────────────────────────────────────────────────────────

function fail(msg, code = 1) {
  console.error(`\x1b[31m❌ ${msg}\x1b[0m`);
  process.exitCode = code;
  throw new Error(msg);
}

/**
 * Échappe un identifiant PostgreSQL (noms de bases, tables, colonnes).
 * PostgreSQL ne supporte pas les requêtes paramétrées pour les identifiants,
 * donc on double les guillemets — c'est la seule manière safe.
 */
function escapeIdent(ident) {
  return `"${ident.replace(/"/g, '""')}"`;
}

/**
 * Extrait et valide un `DATABASE_URL`.
 * Renvoie l'URL système (base `postgres`) avec le même protocole/host/SSL.
 */
function parseDbUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`DATABASE_URL invalide : ${raw}`);
  }

  const protocol = url.protocol.replace(":", "");
  if (protocol !== "postgres" && protocol !== "postgresql") {
    fail(`Protocole non supporté : ${protocol}. Attendu : postgres://`);
  }

  const targetDb = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!targetDb) {
    fail(`DATABASE_URL doit contenir un nom de base (ex : postgres://.../troxt_db)`);
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(targetDb)) {
    fail(`Nom de base invalide : "${targetDb}". Attendu : alphanumérique + underscore.`);
  }

  // Reconstruit l'URL système en PRÉSERVANT le SSL (search params)
  const systemUrl = new URL(raw);
  systemUrl.pathname = "/postgres";
  // systemUrl.search est préservé automatiquement

  const hasSsl = url.searchParams.get("sslmode") === "require"
    || url.searchParams.get("ssl") === "true";

  return {
    targetDb,
    systemUrl: systemUrl.toString(),
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    hasSsl,
  };
}

// ─── Script principal ───────────────────────────────────────────────

async function createDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    fail("DATABASE_URL manquant dans l'environnement (fichier : " + envFile + ")");
  }

  const { targetDb, systemUrl, host, port, user, hasSsl } = parseDbUrl(raw);

  console.log(`\x1b[36m🔍 Cible\x1b[0m`);
  console.log(`   host     : ${host}:${port}`);
  console.log(`   user     : ${user}`);
  console.log(`   database : ${targetDb}`);
  console.log(`   ssl      : ${hasSsl ? "oui" : "non"}`);
  console.log(`   env file : ${envFile}`);
  console.log("");

  const client = new Client({
    connectionString: systemUrl,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    // En dev local, pas de TLS. En prod, laisse `pg` utiliser sslmode du DSN.
    ...(hasSsl ? {} : { ssl: false }),
  });

  try {
    await client.connect();
    console.log("\x1b[32m✅ Connecté au serveur PostgreSQL\x1b[0m");

    // 1. Vérifier l'existence (requête paramétrée : safe)
    const check = await client.query(
      "SELECT 1 AS exists FROM pg_database WHERE datname = $1",
      [targetDb],
    );

    if (check.rows.length > 0) {
      console.log(`\x1b[36mℹ️  La base "${targetDb}" existe déjà — rien à faire.\x1b[0m`);
      return;
    }

    // 2. Créer (identifiant échappé : safe)
    console.log(`\x1b[33m📦 Création de la base "${targetDb}"...\x1b[0m`);
    await client.query(`CREATE DATABASE ${escapeIdent(targetDb)}`);
    console.log(`\x1b[32m✅ Base "${targetDb}" créée avec succès\x1b[0m`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err?.code;

    console.error(`\x1b[31m❌ Erreur : ${message}\x1b[0m`);

    // Diagnostic ciblé
    if (code === "ECONNREFUSED") {
      console.error("\x1b[33m💡 PostgreSQL n'est pas démarré ou n'écoute pas sur ce port.\x1b[0m");
    } else if (code === "ETIMEDOUT" || code === "ENOTFOUND") {
      console.error(`\x1b[33m💡 Hôte "${host}" injoignable. Vérifie le réseau / firewall.\x1b[0m`);
    } else if (code === "28P01") {
      console.error("\x1b[33m💡 Mot de passe incorrect pour l'utilisateur PostgreSQL.\x1b[0m");
    } else if (code === "3D000") {
      console.error(`\x1b[33m💡 La base "postgres" n'existe pas sur ce serveur.\x1b[0m`);
    } else if (code === "42501") {
      console.error(
        `\x1b[33m💡 L'utilisateur "${user}" n'a pas la permission CREATEDB.\n` +
        `   Solution : GRANT CREATEDB TO "${user}"; (en tant que superuser)\x1b[0m`,
      );
    } else if (code === "42P04") {
      console.error("\x1b[33m💡 La base existe déjà (course entre check et create).\x1b[0m");
    } else {
      console.error(`\x1b[33m💡 Vérifie DATABASE_URL et que PostgreSQL est démarré.\x1b[0m`);
    }

    process.exitCode = 1;
  } finally {
    // Ferme TOUJOURS la connexion, même en cas de throw
    try {
      await client.end();
    } catch { /* ignore */ }
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────────

createDatabase()
  .then(() => {
    // ✅ Sans ceci, le process peut rester pendu si un handle traîne
    process.exit(process.exitCode ?? 0);
  })
  .catch((err) => {
    // Les erreurs non capturées par fail() / try-catch
    console.error("\x1b[31m❌ Erreur fatale :", err, "\x1b[0m");
    process.exit(1);
  });