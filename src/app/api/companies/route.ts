import { NextResponse } from "next/server";
import { createCompanyRepository } from "@/data/supabase-company-repository";
import { DataAccessError, InvalidInputError } from "@/domain/errors";
import { searchCompanies } from "@/server/company-use-cases";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("query");
    const companies = await searchCompanies(createCompanyRepository(), query);
    return NextResponse.json({ companies }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidInputError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 });
    if (error instanceof DataAccessError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 503 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다." } }, { status: 500 });
  }
}
