import postgres from "postgres";
import { getEnv } from "../config.js";

let sql: ReturnType<typeof postgres> | null = null;

function createClient() {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  // Transaction pooler (port 6543) requires prepare: false
  const isTransactionPooler =
    DATABASE_URL.includes(":6543") || DATABASE_URL.includes("pgbouncer=true");

  return postgres(DATABASE_URL, {
    ssl: "require",
    prepare: !isTransactionPooler,
    max: 10,
  });
}

export function getSql() {
  if (!sql) {
    sql = createClient();
  }
  return sql;
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await getSql()`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
  }
}
