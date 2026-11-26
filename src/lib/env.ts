import { z } from 'zod';
const schema = z.object({ VITE_SUPABASE_URL: z.string().url().optional().or(z.literal('')), VITE_SUPABASE_ANON_KEY: z.string().optional() });
export const env = schema.parse(import.meta.env);
