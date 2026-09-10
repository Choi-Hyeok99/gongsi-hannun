# 초기 데이터베이스 migration 계획

> 상태: `REVIEW`
> 대상: Supabase PostgreSQL
> 기준 문서: `DECISIONS.md`, `DB_SCHEMA.md`, `ARCHITECTURE.md`, `PRD.md`
> 범위: 첫 migration 설계 계획. 이 문서는 실행 SQL이나 애플리케이션 코드를 포함하지 않는다.

## 1. 목표와 적용 기준

첫 migration은 다음 일곱 테이블을 안전하게 생성하고, 재수집과 재분석의 멱등성, 최소 계정정보와 관심기업을 지원해야 한다.

1. `companies`
2. `ingestion_runs`
3. `source_disclosures`
4. `events`
5. `ai_analyses`
6. `profiles`
7. `watchlist_companies`

인증 자격증명은 Supabase Auth의 `auth.users`가 소유한다. public 테이블에 비밀번호, 비밀번호 해시, 이메일 또는 OAuth 토큰을 복제하지 않는다.

적용 기준은 다음과 같다.

- MVP 지원 시장은 `KOSPI`, `KOSDAQ`이다. 그 밖의 시장은 수집 대상에서 제외한다.
- OpenDART 메타데이터와 공식 원문 링크를 저장하며, 이용조건 확인 전에는 공시 본문 전문을 영구 저장하지 않는다.
- 공개 읽기는 Next.js 서버 데이터 계층을 통한다. 브라우저 익명 역할에는 테이블 직접 쓰기 권한을 주지 않는다.
- 모든 시각은 `timestamptz`, 공시일과 사건일은 달력 날짜 의미의 `date`로 저장한다.
- 사용자 화면의 "오늘"은 KST(`Asia/Seoul`) 경계로 계산한다.
- 원천 공시, 정규화 이벤트, AI 해석을 분리하고 물리 삭제보다 상태 변경을 우선한다.

## 2. migration 파일 구성

첫 적용은 실패 지점을 좁히고 재적용을 검증하기 쉽도록 책임별 파일로 나눈다. 파일명의 실제 timestamp는 생성 시점에 정한다.

| 순서 | migration 책임 | 주요 내용 |
|---|---|---|
| 1 | 확장과 공용 함수 | `pg_trgm` 승인 시 확장 활성화, `updated_at` trigger 함수 |
| 2 | 독립 테이블 | `companies`, `ingestion_runs` |
| 3 | 원천 데이터 | `source_disclosures` 및 외래키 |
| 4 | 도메인 데이터 | `events`, `ai_analyses` 및 외래키 |
| 5 | 인덱스 | 검색, 홈, 타임라인, 배치 조회용 인덱스 |
| 6 | 계정 관계 | `profiles`, `watchlist_companies`, Auth FK와 사용자 삭제 정책 |
| 7 | 권한과 RLS | 전체 테이블 RLS, 본인 소유 정책, 서버 전용 수집 쓰기 |
| 8 | 검증 | 제약, 멱등성, 사용자 A/B 격리, 쿼리 계획, 재적용 검증 |

초기 개발에서 하나의 migration 파일로 합쳐야 한다면 위 순서를 파일 내부에서 그대로 유지한다. 테이블을 만든 뒤 제약과 인덱스를 추가하고, 마지막에 권한을 적용한다.

### 계정·관심기업 보안 검증

- 익명 사용자는 모든 테이블에 직접 쓰지 못한다.
- 인증 사용자 A는 사용자 B의 프로필과 관심기업을 조회·변경·삭제하지 못한다.
- 프로필 갱신 권한은 `nickname` 컬럼으로 제한하고 권한 승격용 컬럼을 두지 않는다.
- 관심기업 INSERT는 `WITH CHECK (auth.uid() = user_id)`를 반드시 통과한다.
- 사용자 삭제는 프로필·관심기업만 CASCADE하며 공시·이벤트 이력에는 영향을 주지 않는다.
- service-role 키는 서버 비밀 저장소에만 두고 브라우저 번들, 로그, migration에 넣지 않는다.
- migration에서 `service_role` 테이블 권한을 명시하고, 공개 데이터도 브라우저가 Supabase를 직접 조회하지 않고 Next.js 서버의 허용 목록 DTO를 통해 읽는다.

## 3. 타입과 제약 전략

### 3.1 PostgreSQL enum 사용 여부

첫 migration에서는 PostgreSQL native enum 대신 `text`와 이름 있는 `CHECK` 제약을 사용한다.

이유:

- 이벤트 분류표와 중요도 규칙은 `PROVISIONAL`이며 실제 공시 표본 검증 후 변경될 수 있다.
- PostgreSQL enum 값 삭제·이름 변경은 text check보다 migration과 롤백이 까다롭다.
- TypeScript 도메인 타입은 DB check 목록에서 별도로 생성하거나 수동 동기화할 수 있다.

값이 안정화된 이후에도 native enum 전환은 필수가 아니다. 변경 빈도, 타입 생성 자동화와 운영 경험을 측정한 후 별도 결정으로 남긴다.

### 3.2 값 범위 제약

첫 migration에서 다음 named check를 둔다.

| 테이블 | 컬럼 | 허용 값 또는 규칙 |
|---|---|---|
| `companies` | `market` | `KOSPI`, `KOSDAQ`; 원천 동기화에서 제외 대상을 보존해야 한다면 `OTHER` 추가 여부를 먼저 결정 |
| `ingestion_runs` | `job_type` | `COMPANY_SYNC`, `DISCLOSURE_COLLECT`, `AI_ANALYZE` |
| `ingestion_runs` | `status` | `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED` |
| `events` | `visibility` | `PUBLIC`, `HIDDEN`, `REVIEW_REQUIRED` |
| `ai_analyses` | `status` | `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED` |
| `events` | `rule_importance_score` | `0` 이상 `100` 이하 |
| `ai_analyses` | `ai_importance_score` | NULL 또는 `0` 이상 `100` 이하 |
| `ingestion_runs` | 집계 컬럼 | 모두 `0` 이상 |
| `ai_analyses` | `attempt_count` | `0` 이상 |

`events.event_type`의 check 목록은 `DEC-003` 분류표 v1이 `REVIEW`를 통과한 뒤 고정한다. 확정 전 migration을 만들어야 한다면 `OTHER`를 포함한 `DB_SCHEMA.md` 후보 목록을 임시 check로 사용하되, 제약 이름에 버전(`event_type_v1`)을 표시한다.

### 3.3 형식과 상태 일관성

- `companies.dart_corp_code`: 실제 OpenDART 표본 검증 후 정확히 8자리 숫자 check를 적용한다.
- `companies.stock_code`: NULL 또는 6자리 숫자 check를 적용한다. `is_active = true`이면서 `is_listed = true`인 행에 필수로 둘지는 실제 동기화 표본 확인 후 결정한다.
- `source_disclosures.receipt_no`: 실제 표본 검증 후 길이와 숫자 형식 check를 적용한다. 검증 전에는 `varchar(14)`만 사용한다.
- `ingestion_runs`: `RUNNING`이면 `finished_at`이 NULL이고 종료 상태이면 `finished_at`이 존재하도록 하는 제약은 작업 생성·종료 트랜잭션 설계와 함께 검증한다.
- `ai_analyses`: `SUCCEEDED` 상태에서 `generated_at`, `plain_summary`, `model_provider`, `model_name`을 필수로 요구하는 상태 check를 둔다. 실패·대기 상태에서는 결과 컬럼을 NULL로 허용한다.
- JSONB 배열인 `importance_reasons`, `checkpoints`, `cautions`에는 기본값 `[]`를 사용하고 `jsonb_typeof(...) = 'array'` check를 둔다.
- JSONB 객체인 `facts`, `raw_metadata`, `extracted_facts`, `metadata`는 NULL 허용 정책을 컬럼별로 유지하되 값이 있으면 객체인지 검증한다.

### 3.4 고유성과 멱등성

- `companies(dart_corp_code)` unique
- `companies(stock_code)` unique; PostgreSQL의 NULL 허용 unique 동작을 그대로 사용
- `source_disclosures(source, receipt_no)` unique
- `events(source_disclosure_id)` unique
- `ai_analyses(event_id, analysis_version)` unique

`ai_analyses.input_hash`는 입력 변경 감지용이며 단독 unique로 만들지 않는다. 동일 내용이 서로 다른 이벤트에서 나타날 수 있기 때문이다. 애플리케이션은 `(event_id, analysis_version)` 충돌 시 기존 결과를 확인하고, input hash가 다르면 새 분석 버전을 발급한다.

## 4. 테이블 생성 순서

### 4.1 `companies`

- `id` 기본값은 `gen_random_uuid()`를 사용한다.
- `is_listed`, `is_active`는 `NOT NULL`로 만들고 명시적인 기본값을 둔다.
- 비활성·상장폐지 기업도 기존 공시와 이벤트 참조를 위해 행을 유지한다.
- 회사명 부분검색은 `pg_trgm` 승인 여부에 따라 7.1의 두 경로 중 하나를 택한다.

### 4.2 `ingestion_runs`

- 다른 테이블과 독립적으로 생성한다.
- 모든 집계 컬럼은 `NOT NULL DEFAULT 0`으로 만든다.
- 오류 메시지에 API 키, 원문 전문이나 개인정보가 들어가지 않도록 애플리케이션 계약을 별도로 검증한다.
- 성공한 최근 수집 시각 조회를 위해 부분 인덱스를 둔다.

### 4.3 `source_disclosures`

- `companies`, `ingestion_runs` 이후 생성한다.
- OpenDART 레코드는 접수번호 단위로 append/upsert하며 원본 식별자를 덮어쓰지 않는다.
- `raw_metadata`에는 이용조건이 허용된 메타데이터만 저장한다.
- 정정·취소 관계 표현은 6장의 정책을 반영하되 실제 표본 확인을 migration 적용 전 gate로 둔다.

### 4.4 `events`

- `companies`, `source_disclosures` 이후 생성한다.
- MVP에서는 공시 한 건당 대표 이벤트 한 건을 보장한다.
- `company_id`는 조회 성능을 위한 의도적인 중복 참조다. event와 source disclosure의 회사가 같은지는 DB 단일 FK만으로 보장되지 않으므로 삽입 함수 또는 서버 트랜잭션에서 검증하고 DB 통합 테스트로 고정한다.
- `occurred_on`이 원문 사건일인지 공시일 fallback인지 `facts` 내부에 숨기지 않고, 향후 필요하면 `occurred_on_basis` 컬럼을 추가한다. 첫 migration 반영 여부는 백엔드 데이터 계약 검토에서 결정한다.

### 4.5 `ai_analyses`

- `events` 이후 생성한다.
- 분석 재실행은 기존 성공 행을 덮어쓰지 않고 새 `analysis_version`으로 남긴다.
- `status`, `attempt_count`, `error_code`로 제한 재시도와 운영 조회를 지원한다.
- 공개 서버 조회는 성공 상태만 선택하며, 원천 추출 결과와 오류 필드는 외부 응답에서 제외한다.

## 5. 외래키 삭제 정책

운영 데이터의 추적성을 우선하며 도메인 데이터에는 cascade delete를 사용하지 않는다.

| 자식 컬럼 | 부모 | 삭제 정책 | 근거 |
|---|---|---|---|
| `source_disclosures.company_id` | `companies.id` | `ON DELETE RESTRICT` | 기업 삭제로 공식 공시 이력이 사라지는 것을 방지 |
| `source_disclosures.ingestion_run_id` | `ingestion_runs.id` | `ON DELETE SET NULL` | 실행 로그 정리 시 공시 자체는 보존 |
| `events.company_id` | `companies.id` | `ON DELETE RESTRICT` | 회사 타임라인과 이벤트 이력 보존 |
| `events.source_disclosure_id` | `source_disclosures.id` | `ON DELETE RESTRICT` | 이벤트의 공식 근거 삭제 방지 |
| `ai_analyses.event_id` | `events.id` | `ON DELETE RESTRICT` | 분석 이력과 재현성 보존 |
| 정정 관계의 자기 참조 FK | `source_disclosures.id` | `ON DELETE SET NULL` | 관계 대상 정리 시 새 공시 레코드 보존 |

테스트 데이터 초기화는 production 정책을 cascade로 바꾸지 않고 Supabase 로컬 DB reset 또는 FK 역순 truncate로 처리한다. 사용자 노출 중단은 `companies.is_active`, `events.visibility`와 정정 상태를 이용한다.

## 6. 정정·취소공시 표현

정정공시는 새 접수번호를 가진 별도 `source_disclosures` 행으로 저장하고 기존 행을 덮어쓰지 않는다. 하나의 체인에서 원본과 후속 공시를 추적할 수 있어야 한다.

권장 추가 컬럼 초안:

| 컬럼 | 의미 |
|---|---|
| `disclosure_status` | `ACTIVE`, `CORRECTED`, `CANCELLED`, `REVIEW_REQUIRED` |
| `corrects_disclosure_id` | 이 공시가 정정하는 직전 공시의 nullable 자기 참조 FK |
| `correction_kind` | NULL, `CORRECTION`, `CANCELLATION`, `WITHDRAWAL` |

처리 규칙:

1. 모든 접수번호를 별도 원천 행으로 먼저 저장한다.
2. OpenDART가 명시적으로 제공하거나 검증된 규칙으로 연결 가능한 경우에만 `corrects_disclosure_id`를 설정한다.
3. 연결이 불확실하면 추정하지 않고 새 행을 `REVIEW_REQUIRED`로 둔다.
4. 정정 대상 원천 행은 삭제하지 않고 `CORRECTED` 또는 `CANCELLED` 상태로 전환한다.
5. 대상 이벤트는 즉시 삭제하지 않는다. 노출 가능성을 재평가해 `REVIEW_REQUIRED` 또는 `HIDDEN`으로 바꾸고, 확정된 최신 공시로 새 이벤트를 생성하거나 안전하게 갱신한다.
6. 이미 생성한 AI 설명은 원문 관계가 바뀌면 공개 대상에서 제외하고 새로운 `analysis_version`으로 재분석한다.

위 컬럼명과 상태 목록은 실제 정정·취소공시 표본 최소 3종을 확인한 뒤 확정한다. OpenDART 응답만으로 신뢰할 수 있는 관계 키를 얻지 못하면 `corrects_disclosure_id`를 자동 채우지 않고 운영 검토 대상으로 남긴다.

## 7. 인덱스 계획

인덱스는 실제 서버 조회 형태와 같은 정렬 및 필터 순서를 사용한다. 페이지네이션 정렬에는 항상 `id`를 마지막 tie-breaker로 넣는다.

### 7.1 기업 검색

필수:

- `companies(stock_code)` unique index: 6자리 종목코드 정확 검색
- `companies(dart_corp_code)` unique index: 동기화 upsert
- 활성 기업 목록 보조 인덱스: `(market, name_ko, id) WHERE is_active = true AND is_listed = true`

회사명 부분검색 권장안:

- Supabase 개발 프로젝트에서 `pg_trgm` 사용 가능 여부를 확인한다.
- 사용 가능하면 `name_ko gin_trgm_ops` GIN 인덱스를 생성한다. 활성 기업만 대상으로 하는 partial GIN 지원 및 쿼리 사용 여부를 `EXPLAIN`으로 확인한다.
- 확장을 쓰지 못하면 MVP에서는 prefix 검색으로 제한하고 정규화된 `search_name_ko` 컬럼과 btree pattern index를 검토한다.
- 한글 포함 검색어 최소 길이를 서버에서 제한해 한 글자 전체 스캔을 방지한다.

### 7.2 오늘 주요 이벤트

KST 기준 날짜를 애플리케이션에서 `date` 값으로 계산해 `occurred_on = :kst_date`로 전달한다. DB 세션 timezone에 의존하지 않는다.

권장 partial index:

- `(occurred_on DESC, rule_importance_score DESC, id DESC) WHERE visibility = 'PUBLIC'`

이 인덱스는 오늘 공개 이벤트를 중요도순으로 가져오는 쿼리를 지원한다. 카드에 필요한 회사명 조인은 `company_id` PK lookup으로 시작하고, 실제 실행 계획에서 heap fetch가 병목일 때만 `INCLUDE (company_id, event_type, title, published_at)`를 검토한다.

### 7.3 오늘 주요 기업

당일 공개 이벤트를 `company_id`로 group하고 `max(rule_importance_score)`, 합계와 건수를 계산한다. 초기에는 7.2 인덱스를 공유한다.

- 데이터량이 작을 때 별도 집계 인덱스나 materialized view를 만들지 않는다.
- `EXPLAIN (ANALYZE, BUFFERS)`에서 당일 필터 후 group 비용이 목표를 넘을 때 `(occurred_on, company_id, rule_importance_score DESC) WHERE visibility = 'PUBLIC'` 인덱스를 추가 후보로 삼는다.
- materialized view와 캐시는 측정된 병목이 있을 때만 후속 결정으로 도입한다.

### 7.4 회사 이벤트 타임라인

권장 partial index:

- `(company_id, occurred_on DESC, id DESC) WHERE visibility = 'PUBLIC'`

커서는 `(occurred_on, id)` 복합 값으로 사용한다. 같은 날 여러 이벤트가 있어도 중복 또는 누락 없이 다음 페이지를 가져와야 한다.

### 7.5 수집 및 분석 작업

- `source_disclosures(company_id, disclosed_on DESC, receipt_no DESC)`
- `source_disclosures(disclosed_on DESC, receipt_no DESC)`
- `ingestion_runs(job_type, started_at DESC)`
- `(job_type, finished_at DESC) WHERE status = 'SUCCEEDED'` — 데이터 최신성
- `ai_analyses(status, created_at, id)` — 처리 대기열
- `(event_id, generated_at DESC, id DESC) WHERE status = 'SUCCEEDED'` — 공개용 최신 성공 분석

각 인덱스는 실제 쿼리가 추가될 때 중복 여부를 확인한다. unique index의 선두 컬럼으로 이미 해결되는 조회에는 별도 index를 만들지 않는다.

## 8. `updated_at` 처리

`companies`, `source_disclosures`, `events`, `ai_analyses`에 공용 `set_updated_at()` trigger를 적용한다.

정책:

- INSERT 시 `created_at`과 `updated_at` 기본값은 `now()`다.
- UPDATE 시 `BEFORE UPDATE` trigger가 `updated_at = now()`로 설정한다.
- 애플리케이션이 전달한 `updated_at` 값은 신뢰하지 않는다.
- `ingestion_runs`는 실행 상태 시간인 `started_at`, `finished_at`이 핵심이므로 일반 `updated_at`을 추가하지 않는다.
- trigger 함수는 고정된 `search_path`를 사용하고, 호출자 권한 상승이 필요하지 않으므로 기본적으로 `SECURITY INVOKER` 의미를 유지한다.
- 의미 없는 upsert도 timestamp를 바꾸지 않도록 collector의 `DO UPDATE ... WHERE`에서 실제 변경 컬럼을 비교한다.

검증 시 하나의 트랜잭션 안에서 `now()`가 동일할 수 있음을 고려한다. timestamp 증가 여부를 검사하기보다 값 변경 시 trigger가 애플리케이션 입력을 덮어쓰는지 확인한다.

## 9. 권한과 RLS 계획

`DEC-009`에 따라 공개 읽기는 Next.js 서버 데이터 계층을 기본 경계로 한다.

- 모든 테이블에 RLS를 활성화한다.
- `anon`, `authenticated` 역할에는 insert, update, delete 권한을 부여하지 않는다.
- MVP에서 브라우저의 직접 select가 필요하지 않으면 공개 select policy도 만들지 않는다.
- 서버 전용 자격 증명은 서버와 배치 환경에서만 사용하고 브라우저 번들에 포함하지 않는다.
- 향후 익명 직접 읽기를 도입한다면 원천 테이블을 노출하지 않고 제한된 view 또는 RPC를 별도 migration으로 검토한다.
- `raw_metadata`, `error_message`, 모델 처리 메타데이터는 공개 응답 계약에서 제외한다.

RLS가 활성화되어도 service-role 키는 강한 권한을 가지므로 키 관리와 서버 응답 필드 제한을 별도로 테스트한다.

## 10. 검증 쿼리 계획

실제 검증 SQL은 migration과 함께 `tests/db` 또는 별도 검증 스크립트로 작성한다. 아래 항목을 자동 검증한다.

### 10.1 스키마와 제약

- 모든 테이블, 컬럼, 기본값, named check, FK와 인덱스가 존재한다.
- 허용되지 않은 market, job/status, visibility와 점수 범위가 거부된다.
- 음수 집계와 음수 시도 횟수가 거부된다.
- 필수 JSONB 배열에 객체를 넣으면 거부된다.
- 종목코드, 접수번호, 분석 버전의 고유 제약이 동작한다.

### 10.2 외래키와 삭제

- 기업을 참조하는 공시 또는 이벤트가 있으면 기업 삭제가 거부된다.
- 원천 공시를 참조하는 이벤트가 있으면 공시 삭제가 거부된다.
- 이벤트를 참조하는 AI 분석이 있으면 이벤트 삭제가 거부된다.
- ingestion run 삭제 시 연결된 공시가 보존되고 FK만 NULL이 된다.
- 정정 관계의 부모 삭제 시 후속 공시가 보존된다.

### 10.3 멱등성

- 같은 기업 코드를 두 번 upsert해도 회사가 한 행이다.
- 같은 `(source, receipt_no)`를 두 번 수집해도 공시가 한 행이다.
- 같은 공시에서 이벤트 생성을 재시도해도 이벤트가 한 행이다.
- 같은 `(event_id, analysis_version)` 분석을 재시도해도 분석이 한 행이다.
- 실제 값이 변하지 않은 upsert는 불필요하게 `updated_at`을 변경하지 않는다.

### 10.4 KST 날짜 경계

- UTC 기준 전날 15:00부터 당일 14:59:59.999...까지가 같은 KST 날짜임을 fixture로 검증한다.
- `occurred_on`을 직접 비교하는 홈 쿼리가 DB 세션 timezone 변경에 영향을 받지 않는다.
- `published_at` 표시는 `Asia/Seoul` 변환 후 기대 날짜와 시각이 된다.

### 10.5 정정공시

- 원본, 정정, 취소가 서로 다른 접수번호와 행으로 보존된다.
- 정정 체인이 원본을 덮어쓰지 않는다.
- 불확실한 연결은 `REVIEW_REQUIRED`로 남는다.
- 취소 또는 중요 정정 이후 기존 이벤트와 AI 분석이 공개 조회에서 제외된다.

### 10.6 공개 조회

- 비활성 기업, `HIDDEN`/`REVIEW_REQUIRED` 이벤트, 실패·대기 분석이 공개 서버 조회 결과에서 제외된다.
- 공식 출처명과 `original_url`은 공개 이벤트 상세에 포함된다.
- `raw_metadata`, 오류 정보와 내부 모델 처리 필드는 반환되지 않는다.
- anon 역할의 insert, update, delete와 직접 select가 거부된다.

## 11. 실행 계획 검증

대표 fixture를 충분히 넣은 뒤 다음 쿼리를 `EXPLAIN (ANALYZE, BUFFERS)`로 검사한다.

| 조회 | 필터와 정렬 | 기대 계획 |
|---|---|---|
| 종목코드 검색 | `stock_code = :code` | unique index scan |
| 회사명 검색 | `name_ko ILIKE :pattern` | 승인된 trigram 또는 prefix index 사용 |
| 오늘 주요 이벤트 | 공개 + `occurred_on = :kst_date`, 중요도/id 내림차순 | partial index range/ordered scan |
| 회사 타임라인 | 공개 + `company_id`, `(occurred_on, id)` cursor | timeline partial index scan |
| 최근 성공 수집 | job type + 성공, `finished_at` 내림차순 limit 1 | success partial index scan |
| 대기 분석 | 상태 + 생성순 limit/lock | analysis queue index scan |

작은 fixture에서는 planner가 sequential scan을 선택할 수 있으므로 단순히 index 이름의 등장만 합격 조건으로 삼지 않는다. 운영 규모를 흉내 낸 fixture에서 rows removed, buffer read, 정렬 발생 여부와 응답 시간을 함께 기록한다.

## 12. 적용과 롤백 검증

1. 깨끗한 로컬 Supabase DB에 migration 전체를 적용한다.
2. 스키마와 권한 검증을 실행한다.
3. 최소 fixture로 멱등성, 정정공시와 공개 조회를 검증한다.
4. 로컬 DB reset 후 migration을 다시 적용한다.
5. 두 번째 적용 결과의 스키마가 첫 적용과 동일한지 확인한다.
6. migration 파일 자체를 반복 실행하는 방식은 요구하지 않는다. Supabase migration 이력과 깨끗한 reset 재적용을 기준으로 한다.
7. 이미 공유 환경에 적용한 migration은 수정하지 않고 후속 migration으로 교정한다.

운영 데이터가 생긴 뒤의 down migration은 기본 배포 절차로 사용하지 않는다. 문제 발생 시 애플리케이션 롤백과 호환 가능한 forward migration을 우선한다.

## 13. migration 작성 전 gate

다음 항목이 해결되거나 명시적인 임시값으로 승인되어야 실제 migration SQL을 작성한다.

- `DEC-003`: 이벤트 분류표 v1과 `event_type` check 목록
- `DEC-012`: OpenDART 메타데이터·본문 저장 허용 범위
- `DEC-019`: Supabase 프로젝트, 리전과 `pg_trgm` 지원 여부
- 실제 OpenDART 표본을 통한 기업 코드, 접수번호 및 정정·취소 관계 검증
- 백엔드와 `occurred_on` 기준, 이벤트/원천 공시 회사 일치 검증 방식 합의
- QA와 KST 경계, 멱등성, 정정공시 fixture 합의

위 gate 중 외부 연동 항목이 남아 있어도 로컬 fixture 기반 migration 검증은 진행할 수 있다. 다만 검증되지 않은 형식과 관계를 강한 DB check로 고정하지 않는다.

## 14. 완료 기준

이 계획을 기반으로 한 첫 migration은 다음 조건을 모두 충족할 때 `DONE`이다.

- 깨끗한 로컬 DB에서 전체 적용과 reset 후 재적용이 성공한다.
- 고유 제약과 외래키 삭제 정책이 자동 테스트로 검증된다.
- KST 날짜 경계와 공개 데이터 필터가 검증된다.
- 검색, 홈, 타임라인 대표 쿼리의 실행 계획이 기록된다.
- anon 직접 쓰기가 차단되고 서버 전용 쓰기 경계가 확인된다.
- 정정·취소공시가 원본을 덮어쓰지 않고 추적된다.
- 실패한 검증, 보류된 gate와 알려진 제한이 숨김없이 기록된다.
