import Link from "next/link";
import React from "react";
import {
  COMPANY_INDUSTRY_CATEGORIES,
  COMPANY_INDUSTRY_CATEGORY_LABELS,
} from "@/domain/company";

type Props = Readonly<{
  query?: string;
  selectedCategory?: string;
}>;

export function CompanyCategoryFilter({ query, selectedCategory = "" }: Props) {
  const makeHref = (category = "") => {
    const parameters = new URLSearchParams();
    if (query) parameters.set("query", query);
    if (category) parameters.set("category", category);
    const suffix = parameters.toString();
    return suffix ? `/search?${suffix}` : "/search";
  };

  return (
    <nav aria-label="업종 카테고리" className="company-category-filter">
      <span className="company-category-filter__label">업종</span>
      <div className="company-category-filter__chips">
        <Link aria-current={!selectedCategory ? "page" : undefined} href={makeHref()}>전체</Link>
        {COMPANY_INDUSTRY_CATEGORIES.map((category) => (
          <Link
            aria-current={selectedCategory === category ? "page" : undefined}
            href={makeHref(category)}
            key={category}
          >
            {COMPANY_INDUSTRY_CATEGORY_LABELS[category]}
          </Link>
        ))}
      </div>
    </nav>
  );
}
