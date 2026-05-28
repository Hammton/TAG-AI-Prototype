import "dotenv/config";
import { createApp } from "./app.js";
import { getEnv, isLlmEnabled, getActiveModel, usesPostgres } from "./config.js";
import { initDataStore } from "./data/index.js";
import { checkDatabase } from "./db/sql.js";

async function main() {
  const env = getEnv();

  if (usesPostgres() && !env.DATABASE_URL) {
    console.error("DATABASE_URL is required (Supabase → Project Settings → Database → URI)");
    process.exit(1);
  }

  initDataStore();

  if (usesPostgres()) {
    const ok = await checkDatabase();
    if (!ok) {
      console.error("Cannot reach Supabase Postgres. Run: npm run db:setup");
      process.exit(1);
    }
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`TAG API  http://localhost:${env.PORT}`);
    console.log(`Data: ${usesPostgres() ? "Supabase Postgres" : "in-memory"}`);
    console.log(
      isLlmEnabled()
        ? `LLM: LangChain → ${getActiveModel()}`
        : "LLM: stub (no OPENROUTER_API_KEY)",
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
