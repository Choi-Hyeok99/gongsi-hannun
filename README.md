<div align="center">

# 공시한눈

### 복잡한 기업 공시를 쉽고 빠르게 이해하는 반응형 웹 서비스

기업에 오늘 어떤 일이 있었는지 확인하고,  
공시에서 확인된 **사실**과 AI가 제공하는 **쉬운 설명**을 구분해 살펴봅니다.

[![Status](https://img.shields.io/badge/status-foundation-17406f?style=flat-square)](#현재-단계)
[![Architecture](https://img.shields.io/badge/architecture-modular%20monolith-087f72?style=flat-square)](#아키텍처)
[![Frontend](https://img.shields.io/badge/frontend-Next.js-000000?style=flat-square&logo=nextdotjs)](#기술-방향)
[![Language](https://img.shields.io/badge/language-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](#기술-방향)
[![Responsive](https://img.shields.io/badge/responsive-360%20%7C%20768%20%7C%201280-1469d2?style=flat-square)](#반응형-웹)

</div>

---

## 서비스 소개

공시한눈은 국내 상장기업의 주요 공시를 한곳에서 찾고 이해하도록 돕는 정보 탐색 서비스입니다.

- 기업명 또는 6자리 종목코드로 검색
- 오늘의 주요 기업 이벤트 확인
- 공시 원문에서 확인된 사실과 AI 해석 분리
- 중요도 점수와 산정 근거 표시
- OpenDART 공식 원문으로 이동
- 과거 기업 이벤트를 시간순으로 탐색

> 공시한눈은 투자 권유, 종목 추천 또는 수익 보장 서비스를 제공하지 않습니다.  
> AI 설명에는 오류가 있을 수 있으므로 투자 판단 전 반드시 공식 원문을 확인해야 합니다.

## 핵심 경험

    기업 검색
       ↓
    오늘의 주요 이벤트
       ↓
    확인된 사실과 쉬운 설명
       ↓
    중요한 이유와 확인할 점
       ↓
    OpenDART 공식 원문

## 현재 단계

현재 프로젝트는 **MVP 기반 설계 및 초기 화면 검증 단계**입니다.

| 영역 | 상태 |
|---|---|
| 제품 요구사항과 MVP 범위 | 설계 완료, 최종 검토 중 |
| 모듈형 모놀리스 구조 | 확정 |
| 데이터베이스 논리 설계 | 초안 완료 |
| 반응형 홈 화면 | mock 화면 검증 중 |
| OpenDART 실제 연동 | 준비 전 |
| AI 분석 실제 연동 | 준비 전 |
| Production 배포 | 준비 전 |

실제 외부 데이터와 AI 호출 전까지는 안전한 fixture와 mock 데이터로 개발합니다.

## 반응형 웹

하나의 웹 애플리케이션으로 휴대폰, 태블릿, PC 브라우저를 지원합니다.

| 기준 폭 | 주요 검수 내용 |
|---|---|
| 360px | 한 손 조작, 카드 가독성, 가로 스크롤 방지 |
| 768px | 태블릿 정보 재배치와 적절한 여백 |
| 1280px | 읽기 폭 제한, 공간 활용, 다단 구성 |

터치뿐 아니라 마우스와 키보드 탐색도 함께 검증합니다.

## 아키텍처

초기 서비스는 운영 복잡도를 낮춘 **모듈형 모놀리스**로 구성합니다.

    사용자 브라우저
          ↓
    Next.js 웹 애플리케이션
       ↙          ↘
    Domain      Data Access → PostgreSQL
       ↑
    Collector · AI Analyzer

- 하나의 저장소
- 하나의 Next.js 애플리케이션
- 하나의 PostgreSQL 데이터베이스
- 수집 및 분석을 위한 소수의 예약 작업
- 측정된 병목이 생기기 전까지 MSA, Kafka, Redis를 도입하지 않음

## 기술 방향

| 구분 | 기술 |
|---|---|
| Web | Next.js, React, TypeScript |
| Styling | Tailwind CSS 검토 |
| Database | Supabase PostgreSQL |
| Data source | OpenDART |
| Testing | Vitest, Playwright 검토 |
| Hosting | Preview 검증 후 최종 확정 |

기술 버전과 배포 플랫폼은 최소 프로젝트의 빌드 및 미리보기 검증 후 고정합니다.

## 개발 흐름

모든 작업은 담당 브랜치에서 시작해 두 번의 검증 단계를 거칩니다.

    work/*
      ↓
    develop     통합 · 자동 테스트 · 빌드
      ↓
    staging     Preview · E2E · 반응형 · 보안 검수
      ↓
    main        Production 준비 완료

커밋 메시지는 닉네임을 사용하지 않고 전문적인 영문 Conventional Commits 형식을 따릅니다.

    feat: add company search
    fix: prevent duplicate disclosures
    test: cover responsive event flow
    docs: clarify event classification

## 담당 역할

| 담당 | 역할 |
|---|---|
| 짱구 (기획) | 제품 범위, 정책, 우선순위, 수용 기준 |
| 맹구 (프론트엔드) | 반응형 화면, 접근성, 사용자 경험 |
| 철수 (백엔드) | OpenDART 수집, 업무 흐름, 서버 계약 |
| 유리 (DB) | PostgreSQL 스키마, migration, 쿼리 |
| 훈이 (QA) | 테스트, 결함 재현, 출시 기준 검증 |

역할별 작업은 별도 브랜치와 Git worktree에서 진행해 충돌을 줄입니다.

## MVP 원칙

1. 공식 출처를 항상 확인할 수 있게 합니다.
2. 사실과 AI 해석을 데이터와 화면에서 구분합니다.
3. 같은 공시를 다시 수집해도 중복 이벤트를 만들지 않습니다.
4. 페이지를 열 때마다 AI를 다시 호출하지 않습니다.
5. 실패, 분석 대기, 빈 데이터 상태를 숨기지 않습니다.
6. 라이선스가 확인되지 않은 뉴스·시세 데이터는 수집하지 않습니다.

---

<div align="center">

공시를 대신 판단하는 서비스가 아니라,  
**공시를 더 잘 확인할 수 있도록 돕는 서비스**를 만듭니다.

</div>
