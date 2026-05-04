import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  // Server-side environment variables schema
  server: {
    DATABASE_URL: z.string().url(),
    USDA_API_KEY: z.string(),
    ANTHROPIC_API_KEY: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  // Client-side environment variables schema
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  // Manual destruction of process.env for Next.js edge runtimes
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    USDA_API_KEY: process.env.USDA_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
