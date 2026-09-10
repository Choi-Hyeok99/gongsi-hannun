import {
  COMPANY_INDUSTRY_CATEGORIES,
  COMPANY_INDUSTRY_CATEGORY_LABELS,
} from "@/domain/company";

type Props = Readonly<{
  query?: string;
  selectedCategory?: string;
}>;

export function CompanyCategoryFilter({ query, selectedCategory = "" }: Props) {
  return (
    <form action="/search" className="company-category-filter">
      {query && <input name="query" type="hidden" value={query} />}
      <label htmlFor="company-category">업종 카테고리</label>
      <div className="company-category-filter__controls">
        <select defaultValue={selectedCategory} id="company-category" name="category">
          <option value="">전체 업종</option>
          {COMPANY_INDUSTRY_CATEGORIES.map((category) => (
            <option key={category} value={category}>{COMPANY_INDUSTRY_CATEGORY_LABELS[category]}</option>
          ))}
        </select>
        <button type="submit">적용</button>
      </div>
    </form>
  );
}
