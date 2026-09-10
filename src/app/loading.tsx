export default function Loading() {
  return (
    <div className="loading-state" role="status">
      <span className="loading-spinner" aria-hidden="true" />
      <span>기업 정보를 불러오는 중입니다.</span>
    </div>
  );
}
