type Props = Readonly<{
  initialQuery?: string;
  autoFocus?: boolean;
}>;

export function CompanySearchForm({ initialQuery = "", autoFocus = false }: Props) {
  return (
    <form action="/search" className="search-form" role="search">
      <label className="sr-only" htmlFor="company-query">기업명 또는 종목코드</label>
      <input
        autoComplete="off"
        autoFocus={autoFocus}
        defaultValue={initialQuery}
        id="company-query"
        maxLength={60}
        name="query"
        placeholder="예: 삼성전자 또는 005930"
        required
        type="search"
      />
      <button type="submit">검색</button>
    </form>
  );
}
