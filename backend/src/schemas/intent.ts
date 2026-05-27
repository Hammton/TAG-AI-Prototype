import { z } from "zod";

export const intentTypeSchema = z.enum([
  "chat",
  "clarify",
  "recommend",
  "generate_spec",
  "generate_quote",
  "generate_engineering",
  "client_blocked",
]);

export type IntentType = z.infer<typeof intentTypeSchema>;

export const intentRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  client_id: z.string().optional(),
  audience: z.enum(["client", "am"]).default("client"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
  has_recommendation: z.boolean().default(false),
  has_vehicle_selected: z.boolean().default(false),
  vehicle_code: z.string().optional(),
});

export type IntentRequest = z.infer<typeof intentRequestSchema>;

export const intentResultSchema = z.object({
  intent: intentTypeSchema,
  /** Natural-language reply when intent is chat or client_blocked */
  reply: z.string().optional(),
  /** Mission text passed to recommend agent (may synthesize from thread) */
  agent_text: z.string().optional(),
  engine: z.enum(["langchain", "stub"]),
});

export type IntentResult = z.infer<typeof intentResultSchema>;
