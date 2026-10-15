import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must have at least 8 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
});

export const env = schema.parse(process.env);
