import { z } from "zod";

export const chatRequestSchema = z.object({
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
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
