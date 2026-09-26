/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CREATE-DB.TS (Version Enrichie)
 * Script d'initialisation et de création automatique de la base PostgreSQL
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : C:\beni\create-db.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Lecture de l'argument --env (ex: --env=.env.development) ou fallback sur .env
const envArg = process.argv.find((arg) => arg.startsWith('--env='));
const envFile = envArg ? envArg.split('=')[1] : '.env';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') }); // Chargement d'appoint

const SIG = 'TROXT⬡';

async function bootstrapDatabase() {
  console.log('');
  console.log(`[${SIG}] 🗄️ Initialisation de la base de données...`);

  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/troxt_db';
  const dbFallback = process.env.DB_FALLBACK || 'pglite';

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch (err) {
    console.error(`[${SIG}] ✖ URL de base de données invalide :`, databaseUrl);
    process.exit(1);
  }

  const targetDbName = url.pathname.replace(/^\//, '') || 'troxt_db';
  const user = url.username || 'postgres';
  const password = decodeURIComponent(url.password || '');
  const host = url.hostname || '127.0.0.1';
  const port = parseInt(url.port || '5432', 10);

  // Connexion à la base système par défaut "postgres" pour créer la base cible
  const client = new pg.Client({
    user,
    password,
    host,
    port,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    console.log(`[${SIG}] ✓ Connecté au serveur PostgreSQL (${host}:${port})`);

    // 1. Vérifier si la base existe déjà
    const checkRes = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDbName]
    );

    if (checkRes.rowCount === 0) {
      console.log(`[${SIG}] ⚡ Création de la base de données "${targetDbName}"...`);
      // Le nom de base ne peut pas être paramétré avec $1 en SQL brut PostgreSQL
      await client.query(`CREATE DATABASE "${targetDbName}" ENCODING 'UTF8' TEMPLATE template1`);
      console.log(`[${SIG}] ✓ Base de données "${targetDbName}" créée avec succès !`);
    } else {
      console.log(`[${SIG}] ℹ La base de données "${targetDbName}" existe déjà.`);
    }

    await client.end();

    // 2. Connexion optionnelle à la base cible pour activer les extensions de base
    const targetClient = new pg.Client({
      user,
      password,
      host,
      port,
      database: targetDbName,
      connectionTimeoutMillis: 5000,
    });

    await targetClient.connect();
    await targetClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await targetClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await targetClient.end();

    console.log(`[${SIG}] ✓ Extensions PostgreSQL (uuid-ossp, pgcrypto) vérifiées.`);
    console.log(`[${SIG}] ✓ Initialisation terminée avec succès.\n`);
    process.exit(0);

  } catch (err: any) {
    console.warn(`\n[${SIG}] ⚠ Impossible de se connecter à PostgreSQL (${err.message})`);

    if (dbFallback === 'pglite') {
      console.log(`[${SIG}] ℹ Mode dégradé actif (DB_FALLBACK=pglite) : la base locale embarquée sera utilisée.`);
      if (client) await client.end().catch(() => {});
      process.exit(0); // Succès pour ne pas bloquer les scripts de setup
    } else {
      console.error(`[${SIG}] ✖ Échec critique : PostgreSQL est requis car DB_FALLBACK est désactivé.`);
      if (client) await client.end().catch(() => {});
      process.exit(1);
    }
  }
}

bootstrapDatabase();