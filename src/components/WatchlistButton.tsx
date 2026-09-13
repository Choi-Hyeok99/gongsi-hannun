import Link from "next/link";
import { updateWatchlist } from "@/app/watchlist/actions";

type Props = Readonly<{
  stockCode: string;
  isAuthenticated: boolean;
  isSaved: boolean;
}>;

export function WatchlistButton({ stockCode, isAuthenticated, isSaved }: Props) {
  const companyPath = `/companies/${stockCode}`;
  if (!isAuthenticated) {
    return <Link className="watchlist-button" href={`/login?next=${encodeURIComponent(companyPath)}`}>☆ 로그인 후 관심기업 저장</Link>;
  }

  return (
    <form action={updateWatchlist}>
      <input type="hidden" name="stockCode" value={stockCode} />
      <input type="hidden" name="intent" value={isSaved ? "remove" : "save"} />
      <button className={`watchlist-button${isSaved ? " watchlist-button--saved" : ""}`} type="submit">
        {isSaved ? "★ 관심기업 해제" : "☆ 관심기업 저장"}
      </button>
    </form>
  );
}
