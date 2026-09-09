import type { Metadata } from "next";
import Link from "next/link";
import { DisclosureList } from "@/components/DisclosureList";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { listLatestDisclosures } from "@/server/disclosure-use-cases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "오늘의 주요 공시 | 공시한눈",
  description: "OpenDART에서 수집한 최신 상장기업 공시를 날짜순으로 확인합니다.",
};

export default async function DisclosuresPage() {
  const disclosures = await listLatestDisclosures(createDisclosureRepository(), 30);

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>오늘의 주요 공시</span></div>
        <section className="page-intro">
          <p className="eyebrow">OpenDART 최신 정보</p>
          <h1>오늘의 주요 공시</h1>
          <p>최근 접수된 상장기업 공시를 날짜순으로 빠르게 살펴보세요.</p>
        </section>
        <section aria-labelledby="latest-disclosures-heading">
          <div className="result-heading">
            <h2 id="latest-disclosures-heading">최신 공시</h2>
            <span>{disclosures.length}건</span>
          </div>
          <DisclosureList disclosures={disclosures} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
