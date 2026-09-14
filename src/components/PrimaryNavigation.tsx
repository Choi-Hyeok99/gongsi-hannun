"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const primaryLinks = [
  { href: "/search", label: "기업", matches: (pathname: string) => pathname === "/search" || pathname.startsWith("/companies/") },
  { href: "/disclosures", label: "오늘의 주요 공시", matches: (pathname: string) => pathname === "/disclosures" || pathname.startsWith("/disclosures/") },
  { href: "/calendar", label: "공시 달력", matches: (pathname: string) => pathname === "/calendar" },
] as const;

export function PrimaryNavigation() {
  const pathname = usePathname();

  return (
    <nav className="primary-navigation" aria-label="주요 메뉴">
      {primaryLinks.map((link) => {
        const isCurrent = link.matches(pathname);
        return (
          <Link aria-current={isCurrent ? "page" : undefined} href={link.href} key={link.href}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
