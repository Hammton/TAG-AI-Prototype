import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().optional(),
  USE_MEMORY_STORE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  CORS_ORIGIN: z.string().default("*"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("qwen/qwen3.5-397b-a17b"),
  OPENROUTER_MODEL_DEV: z.string().default("minimax/minimax-m2.5"),
  /** Comma-separated OpenRouter provider slugs to skip (Novita breaks Qwen 2.5 72B). */
  OPENROUTER_PROVIDER_IGNORE: z.string().default("Novita"),
  USE_PRODUCTION_MODEL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  OPENROUTER_BASE_URL: z
    .string()
    .url()
    .default("https://openrouter.ai/api/v1"),
  AGENT_MAX_TOOL_ITERATIONS: z.coerce.number().default(5),
  TAVILY_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function resetEnvCache(): void {
  cached = null;
}

export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid env: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}

export function getActiveModel(): string {
  const env = getEnv();
  if (env.USE_PRODUCTION_MODEL || env.NODE_ENV === "production") {
    return env.OPENROUTER_MODEL;
  }
  return env.OPENROUTER_MODEL_DEV;
}

export function isLlmEnabled(): boolean {
  return Boolean(getEnv().OPENROUTER_API_KEY);
}

export function usesPostgres(): boolean {
  return !getEnv().USE_MEMORY_STORE;
}
