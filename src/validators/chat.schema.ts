import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1).max(8000),
  mode: z.enum(["medical", "therapy", "recipe"]).default("medical"),
});
