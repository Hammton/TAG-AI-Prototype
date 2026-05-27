import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "..", "sql");

async function main() {
  let raw = process.env.DATABASE_URL ?? "";

  // Defensive cleanup for common copy-paste mistakes
  raw = raw.trim();
  if (raw.startsWith("DATABASE_URL=")) {
    raw = raw.slice("DATABASE_URL=".length);
  }
  if (raw.startsWith('"') || raw.startsWith("'")) {
    raw = raw.slice(1, -1); // strip accidental surrounding quotes
  }

  if (!raw) {
    console.error("DATABASE_URL is required (and currently empty after cleanup)");
    process.exit(1);
  }

  if (raw.includes("[YOUR") || raw.includes("[YOUR-")) {
    console.error("Replace [YOUR-PASSWORD] in DATABASE_URL with your Supabase database password");
    process.exit(1);
  }

  // Basic sanity: must contain a proper host after the last @
  if (!raw.includes("@")) {
    console.error("DATABASE_URL looks invalid — it must contain user:password@host");
    process.exit(1);
  }

  // Helpful log (hides the password)
  const masked = raw.replace(/:[^@]+@/, ":***@");
  console.log("Using DATABASE_URL:", masked);

  const isTransactionPooler = raw.includes(":6543");
  const db = postgres(raw, {
    ssl: "require",
    prepare: !isTransactionPooler,
    max: 1,
  });

  try {
    for (const file of readdirSync(sqlDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      console.log(`Running ${file}...`);
      await db.unsafe(readFileSync(join(sqlDir, file), "utf8"));
      console.log("  OK");
    }
    console.log("Migration complete.");
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
