import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.union([z.string().url(), z.literal('')]).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
});

export const env = schema.parse(import.meta.env);

export const isSupabaseConfigured = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY?.trim(),
);
