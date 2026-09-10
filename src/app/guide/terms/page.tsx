import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { DISCLOSURE_GLOSSARY } from "@/domain/disclosure-glossary";

export const metadata: Metadata = { title: "쉬운 공시 용어 | 공시한눈", description: "자주 나오는 공시 용어를 쉬운 말로 확인합니다." };

export default function TermsGuidePage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>쉬운 공시 용어</span></div>
        <section className="page-intro"><p className="eyebrow">초보 투자자 도움말</p><h1>쉬운 공시 용어</h1><p>공시에서 자주 나오는 표현과 확인할 점을 짧게 정리했습니다.</p></section>
        <div className="glossary-grid">
          {DISCLOSURE_GLOSSARY.map((entry) => <article className="glossary-card" id={entry.term} key={entry.term}><h2>{entry.term}</h2><p>{entry.meaning}</p><strong>확인할 점</strong><p>{entry.context}</p></article>)}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
