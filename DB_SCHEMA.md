# 초기 DB 스키마 (초안)

> 대상: Supabase PostgreSQL
> 상태: 논리 설계 초안. 승인 후 migration으로 구체화한다.

## 1. 설계 원칙

- OpenDART 원본 메타데이터, 서비스 이벤트, AI 해석을 분리한다.
- 외부 시스템의 안정적인 키를 고유 제약으로 사용해 재수집을 안전하게 만든다.
- 사실과 AI 생성 내용을 서로 다른 테이블에 저장한다.
- 삭제보다 상태 변경을 우선해 출처와 처리 이력을 추적할 수 있게 한다.
- MVP 쿼리에 필요한 인덱스만 만든다. 인증은 Supabase Auth가 소유하고 서비스 DB에는 최소 프로필과 관심기업 관계만 둔다.
- 모든 표시 시각은 DB에 `timestamptz`로 저장하고 UI에서 KST로 변환한다.

## 2. 관계 개요

```text
companies 1 ─── N source_disclosures
companies 1 ─── N events
source_disclosures 1 ─── N disclosure_documents
source_disclosures 1 ─── 0..1 events
events 1 ─── N ai_analyses
ingestion_runs 1 ─── N source_disclosures (선택적 추적)
auth.users 1 ─── 1 profiles
auth.users 1 ─── N watchlist_companies N ─── 1 companies
```

## 3. 테이블

### 3.1 `companies`

국내 상장기업 검색과 공시 연결을 위한 기준정보다.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| `id` | `uuid` | PK, 서버 생성 |
| `dart_corp_code` | `varchar(8)` | NOT NULL, UNIQUE, OpenDART 기업 고유번호 |
| `stock_code` | `varchar(6)` | 상장 종목코드, 활성 대상에는 값 필요 |
| `name_ko` | `text` | NOT NULL, 현재 한글 회사명 |
| `name_en` | `text` | NULL 허용 |
| `market` | `text` | 승인 후 `KOSPI/KOSDAQ/KONEX/OTHER` 범위 확정 |
| `is_listed` | `boolean` | NOT NULL DEFAULT true |
| `is_active` | `boolean` | 서비스 노출/수집 대상 여부 |
| `source_updated_at` | `timestamptz` | 원천 기준정보 확인 시각 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() |

제약/인덱스:

- `UNIQUE (dart_corp_code)`
- `UNIQUE (stock_code)`는 NULL을 허용하며 상장 코드 중복을 방지
- `INDEX (is_active, stock_code)`
- `name_ko` 부분검색은 초기 데이터 규모 측정 후 `pg_trgm` GIN 인덱스를 사용하거나 정규화 검색 컬럼을 둔다.

### 3.2 `ingestion_runs`

기업 동기화, 공시 수집, AI 분석 배치의 실행 상태를 기록한다.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| `id` | `uuid` | PK |
| `job_type` | `text` | `COMPANY_SYNC`, `DISCLOSURE_COLLECT`, `AI_ANALYZE` |
| `status` | `text` | `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED` |
| `range_start` | `timestamptz` | 처리 구간 시작, 해당 시 |
| `range_end` | `timestamptz` | 처리 구간 끝, 해당 시 |
| `started_at` | `timestamptz` | NOT NULL |
| `finished_at` | `timestamptz` | NULL 허용 |
| `read_count` | `integer` | DEFAULT 0 |
| `created_count` | `integer` | DEFAULT 0 |
| `updated_count` | `integer` | DEFAULT 0 |
| `failed_count` | `integer` | DEFAULT 0 |
| `error_code` | `text` | 안전한 요약 코드, NULL 허용 |
| `error_message` | `text` | 비밀/원문 전문을 제외한 운영 메시지 |
| `metadata` | `jsonb` | 페이지 번호 등 비정형 실행 정보 |

인덱스: `INDEX (job_type, started_at DESC)`.

### 3.3 `source_disclosures`

OpenDART에서 얻은 공시의 원본 식별자와 사실 메타데이터를 보존한다.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK -> `companies.id` |
| `ingestion_run_id` | `uuid` | NULL, FK -> `ingestion_runs.id` |
| `source` | `text` | NOT NULL DEFAULT `OPENDART` |
| `receipt_no` | `varchar(14)` | NOT NULL, OpenDART 접수번호 |
| `report_name` | `text` | NOT NULL |
| `filer_name` | `text` | 공시 제출인명 |
| `disclosed_on` | `date` | NOT NULL, 공시일 |
| `received_at` | `timestamptz` | 정확한 시각 확보 시 사용 |
| `original_url` | `text` | NOT NULL, 공식 원문 URL |
| `raw_metadata` | `jsonb` | 허용 범위의 원본 응답 메타데이터 |
| `content_fetched_at` | `timestamptz` | 분석용 본문 확보 시각, NULL 허용 |
| `content_fetch_status` | `text` | `PENDING`, `FETCHING`, `READY`, `UNAVAILABLE`, `FAILED` |
| `content_fetch_error` | `text` | 비밀정보를 제외한 안전한 실패 요약, NULL 허용 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() |

제약/인덱스:

- `UNIQUE (source, receipt_no)`
- `INDEX (company_id, disclosed_on DESC)`
- `INDEX (disclosed_on DESC)`

공시 원문은 공식 OpenDART 원본파일 API에서 서버 작업으로만 수집하며, 실행 가능한 HTML 대신 정리된 일반 텍스트만 저장한다.

### 3.4 `disclosure_documents`

접수번호 하나에 포함된 대표 본문과 첨부문서를 분리해 저장한다.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| `id` | `uuid` | PK |
| `source_disclosure_id` | `uuid` | NOT NULL, FK -> `source_disclosures.id`, 삭제 시 함께 삭제 |
| `sequence_no` | `smallint` | 1~100, 공식 ZIP 내 순서 |
| `document_kind` | `text` | `MAIN`, `ATTACHMENT` |
| `title` | `text` | 문서 내부 제목, 최대 500자 |
| `file_name` | `text` | 경로 문자를 제거한 안전한 파일명 |
| `mime_type` | `text` | 허용된 XML, HTML, 일반 텍스트만 저장 |
| `byte_size` | `integer` | 원본 문서 크기 |
| `content_hash` | `varchar(64)` | 중복 분석 방지용 SHA-256 |
| `content_text` | `text` | 스크립트와 태그를 제거한 일반 텍스트 |
| `is_truncated` | `boolean` | 안전한 저장 한도 때문에 일부만 저장했는지 여부 |
| `fetched_at` | `timestamptz` | 수집 시각 |

사용자 브라우저는 이 테이블을 직접 조회하지 않는다. RLS를 강제하고 `service_role`에만 권한을 부여한다.

### 3.5 `events`

공시를 사용자가 탐색할 수 있는 기업 이벤트로 정규화한 사실 레코드다.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| `id` | `uuid` | PK |
| `company_id` | `uuid` | NOT NULL, FK -> `companies.id` |
| `source_disclosure_id` | `uuid` | NOT NULL, FK -> `source_disclosures.id` |
| `event_type` | `text` | NOT NULL, 아래 초기 분류 후보 |
| `title` | `text` | NOT NULL, 서비스용 사실 중심 제목 |
| `occurred_on` | `date` | NOT NULL, 확인된 사건일 또는 공시일 |
| `published_at` | `timestamptz` | 공시 시각, 없으면 NULL |
| `facts` | `jsonb` | 원문에서 추출·검증된 구조화 사실 |
| `rule_importance_score` | `smallint` | 0~100 |
| `importance_reasons` | `jsonb` | 규칙 코드와 근거 값 배열 |
| `importance_version` | `text` | NOT NULL |
| `visibility` | `text` | `PUBLIC`, `HIDDEN`, `REVIEW_REQUIRED` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() |

제약/인덱스:

- `UNIQUE (source_disclosure_id)` — MVP는 공시 1건당 대표 이벤트 1건을 기본으로 한다. 한 공시에서 복수 사건 분리가 필요해지면 이 제약을 변경한다.
- `CHECK (rule_importance_score BETWEEN 0 AND 100)`
- `INDEX (occurred_on DESC, visibility, rule_importance_score DESC)`
- `INDEX (company_id, occurred_on DESC)`
- `INDEX (event_type, occurred_on DESC)`

초기 이벤트 유형 후보:

- `SUPPLY_CONTRACT`
- `INVESTMENT`
- `FUNDRAISING`
- `M_AND_A`
- `EARNINGS`
- `CAPITAL_CHANGE`
- `SHAREHOLDER_CHANGE`
- `INSIDER_OWNERSHIP_CHANGE`
- `FACILITY_EXPANSION`
- `NEW_BUSINESS`
- `CLINICAL_RESULT`
- `POLICY_SUPPORT`
- `MANAGEMENT_CHANGE`
- `MATERIAL_DISCLOSURE`
- `OTHER`

정확한 한국어 명칭, 공시명 매핑과 MVP 우선 지원 유형은 사용자 승인 후 고정한다.

### 3.6 `ai_analyses`

이벤트 사실과 분리된 AI 생성 설명 및 처리 상태다.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| `id` | `uuid` | PK |
| `event_id` | `uuid` | NOT NULL, FK -> `events.id` |
| `analysis_version` | `text` | NOT NULL, 프롬프트/출력 스키마 버전 |
| `status` | `text` | `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED` |
| `model_provider` | `text` | 성공/실행 시 제공자 |
| `model_name` | `text` | 성공/실행 시 모델 |
| `plain_summary` | `text` | 쉬운 한줄/짧은 설명 |
| `why_it_matters` | `text` | 중요 이유. 해석임을 UI에 표시 |
| `checkpoints` | `jsonb` | 투자자가 원문에서 확인할 항목 배열 |
| `cautions` | `jsonb` | 불확실성·주의사항 배열 |
| `extracted_facts` | `jsonb` | 모델 추출 결과. 공개 전 원문 검증 정책 적용 |
| `ai_importance_score` | `smallint` | NULL 또는 0~100, 보조 값 |
| `input_hash` | `text` | 동일 입력 중복 분석 방지 |
| `attempt_count` | `smallint` | NOT NULL DEFAULT 0 |
| `error_code` | `text` | NULL 허용 |
| `generated_at` | `timestamptz` | 성공 시각 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() |

제약/인덱스:

- `UNIQUE (event_id, analysis_version)`
- `CHECK (ai_importance_score IS NULL OR ai_importance_score BETWEEN 0 AND 100)`
- `INDEX (status, created_at)` — 미처리/실패 작업 조회
- 공개 조회는 기본적으로 `status = 'SUCCEEDED'`만 사용한다.

### 3.7 `profiles`

Supabase Auth 사용자의 서비스 표시정보만 저장한다. 이메일, 비밀번호 해시, OAuth 토큰은 저장하지 않는다.

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| `user_id` | `uuid` | PK, FK -> `auth.users.id`, 사용자 삭제 시 CASCADE |
| `nickname` | `text` | NULL 또는 2~30자, 대소문자 무시 UNIQUE |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() |

생년월일과 성별은 핵심 기능의 수집 목적이 승인되지 않았으므로 저장하지 않는다. RLS로 본인만 조회·닉네임 변경이 가능하다.

### 3.8 `watchlist_companies`

| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| `user_id` | `uuid` | PK 일부, FK -> `auth.users.id`, 사용자 삭제 시 CASCADE |
| `company_id` | `uuid` | PK 일부, FK -> `companies.id`, RESTRICT |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |

`PRIMARY KEY (user_id, company_id)`로 중복 저장을 막고 RLS의 `USING`과 `WITH CHECK`로 본인 행만 접근하게 한다.

## 4. 파생 조회

MVP에서는 별도 집계 테이블을 만들지 않고 인덱스된 쿼리 또는 DB view로 시작한다.

- 오늘 주요 이벤트: KST 당일 `PUBLIC` 이벤트를 중요도순으로 조회
- 오늘 주요 기업: 당일 공개 이벤트를 회사별로 묶어 최대 중요도, 합계/건수로 정렬
- 회사 타임라인: `company_id`와 날짜 커서로 최신순 조회
- 데이터 최신성: 최근 성공한 `DISCLOSURE_COLLECT` 실행 종료 시각

성능 문제가 측정되면 그때 materialized view나 캐시를 검토한다.

## 5. 공개 접근 정책 초안

- 익명 사용자는 `is_active = true` 기업과 `visibility = 'PUBLIC'` 이벤트, 성공한 AI 분석만 읽을 수 있다.
- 브라우저에서 원천 테이블 전체를 직접 수정할 수 없게 한다.
- 배치 쓰기는 서버 전용 키로 수행한다.
- `raw_metadata`, 오류 메시지, 모델 처리 메타데이터는 공개 API 응답에서 제외한다.
- 인증정보는 `auth.users`에만 두고 public 스키마에는 비밀번호·이메일·OAuth 토큰을 복제하지 않는다.
- 익명·인증 사용자는 원천/이벤트/분석/작업 테이블에 직접 쓰지 못한다. 공개 읽기는 Next.js 서버 데이터 계층이 허용 목록 DTO로 제공한다.
- `profiles`, `watchlist_companies`는 RLS를 강제하고 본인 행만 접근시킨다.
- 전송 암호화(TLS)와 관리형 저장 암호화는 Supabase 설정으로 확인한다. 복호화가 필요한 필드 암호화는 승인된 목적과 외부 KMS 키 관리가 있을 때만 추가하며 migration이나 코드에 키를 넣지 않는다.

## 6. 보존 및 정정

- 공시 정정/취소가 들어오면 원본 레코드를 덮어 숨기지 않고 관련 상태를 반영하는 방식을 구현 단계에서 확정한다.
- AI 재분석은 새 `analysis_version` 행으로 남겨 재현성을 유지한다.
- 원본 payload와 분석 입력의 보존 기간은 OpenDART 이용조건, 비용, 감사 필요성을 검토한 후 확정한다.

## 7. 구현 전 확인 항목

- 지원 시장과 종목 범위
- OpenDART 필드 길이, 접수번호 형식, 정정공시 관계의 실제 샘플 검증
- 한 공시당 한 이벤트 가정의 적합성
- 이벤트 유형/중요도 규칙표
- 본문 저장 가능 범위와 보존 기간
- Supabase 프로젝트 리전, 확장 기능(`pg_trgm`) 사용 여부
- 공개 읽기를 RLS 직접 조회로 할지 Next.js 서버 경유로 통일할지
