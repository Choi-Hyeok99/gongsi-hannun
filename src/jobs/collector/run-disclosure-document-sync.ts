import { z } from "zod";
import { createSupabaseDisclosureDocumentSyncRepository } from "@/data/supabase-disclosure-document-sync-repository";
import { OpenDartDocumentClient } from "@/jobs/collector/open-dart-document-client";
import { syncDisclosureDocuments } from "@/jobs/collector/sync-disclosure-documents";

const environmentSchema = z.object({
  OPENDART_API_KEY: z.string().regex(/^[A-Za-z0-9]{40}$/),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  DISCLOSURE_DOCUMENT_SYNC_LIMIT: z.coerce.number().int().min(1).max(200).default(50),
});

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const counts = await syncDisclosureDocuments({
    source: new OpenDartDocumentClient({ apiKey: environment.OPENDART_API_KEY }),
    repository: createSupabaseDisclosureDocumentSyncRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
    }),
  }, environment.DISCLOSURE_DOCUMENT_SYNC_LIMIT);
  console.info(`공시 원문 수집 완료: 공시 ${counts.disclosureCount}, 문서 ${counts.documentCount}, 실패 ${counts.failedCount}`);
  if (counts.failedCount > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "공시 원문 수집에 실패했습니다.");
  process.exitCode = 1;
});

