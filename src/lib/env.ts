import { z } from 'zod';

export const environmentSchema = z
  .object({
    VITE_SUPABASE_URL: z.union([z.string().url(), z.literal('')]).optional(),
    VITE_SUPABASE_ANON_KEY: z.string().trim().optional(),
  })
  .superRefine((environment, context) => {
    const hasUrl = Boolean(environment.VITE_SUPABASE_URL?.trim());
    const hasKey = Boolean(environment.VITE_SUPABASE_ANON_KEY);

    if (hasUrl !== hasKey) {
      context.addIssue({
        code: 'custom',
        path: ['VITE_SUPABASE_ANON_KEY'],
        message: 'Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or leave both empty.',
      });
    }
  });

export const env = environmentSchema.parse(import.meta.env);

export const isSupabaseConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
