import { z } from "zod";

const publicEnvironmentSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(20),
});

export function readPublicSupabaseEnvironment() {
  return publicEnvironmentSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function readSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return configuredUrl ? z.url().parse(configuredUrl).replace(/\/$/, "") : "http://localhost:3000";
}
