import { ChatOpenAI } from "@langchain/openai";
import { getActiveModel, getEnv } from "../config.js";

export function createChatModel(options?: { temperature?: number }) {
  const env = getEnv();
  const model = getActiveModel();

  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const ignore = env.OPENROUTER_PROVIDER_IGNORE.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return new ChatOpenAI({
    model,
    temperature: options?.temperature ?? 0.1,
    apiKey: env.OPENROUTER_API_KEY,
    modelKwargs:
      ignore.length > 0
        ? { provider: { ignore } }
        : undefined,
    configuration: {
      baseURL: env.OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://tag-vehicle-config.local",
        "X-Title": "TAG Vehicle Config Agent",
      },
    },
  });
}
