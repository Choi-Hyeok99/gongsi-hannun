type Props = Readonly<{
  initialQuery?: string;
  category?: string;
  autoFocus?: boolean;
}>;

export function CompanySearchForm({ initialQuery = "", category, autoFocus = false }: Props) {
  return (
    <form action="/search" className="search-form" role="search">
      {category && <input name="category" type="hidden" value={category} />}
      <label className="sr-only" htmlFor="company-query">기업명 또는 종목코드</label>
      <input
        autoComplete="off"
        autoFocus={autoFocus}
        defaultValue={initialQuery}
        id="company-query"
        maxLength={60}
        name="query"
        placeholder="기업명 또는 6자리 종목코드"
        type="search"
      />
      <button type="submit">검색</button>
    </form>
  );
}
