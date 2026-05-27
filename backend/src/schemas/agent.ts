import { z } from "zod";

export const agentModeSchema = z.enum([
  "recommend",
  "generate_spec",
  "generate_quote",
  "generate_engineering_output",
]);

export const agentRequestSchema = z
  .object({
    mode: agentModeSchema,
    client_id: z.string().optional(),
    vehicle_model_id: z.string().optional(),
    order_id: z.string().optional(),
    configuration_option_ids: z.array(z.string()).optional(),
    qty: z.number().int().positive().optional(),
    user_text: z.string().optional(),
    opportunity_note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "recommend") {
      if (!data.client_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "client_id required",
          path: ["client_id"],
        });
      }
      if (!data.vehicle_model_id && !data.user_text && !data.opportunity_note) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vehicle_model_id or user_text required",
          path: ["vehicle_model_id"],
        });
      }
      return;
    }

    if (data.mode === "generate_quote") {
      if (!data.vehicle_model_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vehicle_model_id required",
          path: ["vehicle_model_id"],
        });
      }
      if (!data.configuration_option_ids?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "configuration_option_ids required",
          path: ["configuration_option_ids"],
        });
      }
      if (!data.qty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "qty required",
          path: ["qty"],
        });
      }
      return;
    }

    if (data.mode === "generate_spec") {
      if (!data.vehicle_model_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vehicle_model_id required",
          path: ["vehicle_model_id"],
        });
      }
      if (!data.configuration_option_ids?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "configuration_option_ids required",
          path: ["configuration_option_ids"],
        });
      }
    }

    if (data.mode === "generate_engineering_output") {
      if (!data.order_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "order_id required",
          path: ["order_id"],
        });
      }
      if (!data.vehicle_model_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vehicle_model_id required",
          path: ["vehicle_model_id"],
        });
      }
      if (!data.configuration_option_ids?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "configuration_option_ids required",
          path: ["configuration_option_ids"],
        });
      }
    }
  });

export type AgentRequest = z.infer<typeof agentRequestSchema>;
