import { z } from "zod";

export const messageRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  client_id: z.string(),
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
  vehicle_model_id: z.string().optional(),
  qty: z.number().int().positive().optional(),
  configuration_option_ids: z.array(z.string()).optional(),
  order_id: z.string().optional(),
});

export type MessageRequest = z.infer<typeof messageRequestSchema>;
