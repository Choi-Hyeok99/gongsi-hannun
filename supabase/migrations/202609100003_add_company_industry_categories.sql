begin;

alter table public.companies
  add column if not exists industry_category text not null default 'UNCLASSIFIED';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_industry_category_check'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_industry_category_check check (
        industry_category in (
          'SEMICONDUCTOR',
          'BIO_HEALTHCARE',
          'IT_SOFTWARE',
          'ELECTRONICS',
          'AUTOMOTIVE',
          'INDUSTRIAL_MANUFACTURING',
          'CHEMICAL_MATERIALS',
          'ENERGY_UTILITIES',
          'FINANCE',
          'CONSUMER_RETAIL',
          'MEDIA_TELECOM',
          'CONSTRUCTION_REAL_ESTATE',
          'TRANSPORT_LOGISTICS',
          'OTHER',
          'UNCLASSIFIED'
        )
      );
  end if;
end
$$;

-- Classify only from a source-provided sector. A missing sector stays explicitly unclassified.
update public.companies
set industry_category = case
  when sector is null or btrim(sector) = '' then 'UNCLASSIFIED'
  when sector ~* '반도체' then 'SEMICONDUCTOR'
  when sector ~* '바이오|제약|의약|의료|헬스케어' then 'BIO_HEALTHCARE'
  when sector ~* '소프트웨어|정보기술|IT 서비스|컴퓨터|인터넷' then 'IT_SOFTWARE'
  when sector ~* '전자|전기|디스플레이|통신장비' then 'ELECTRONICS'
  when sector ~* '자동차|자동차부품' then 'AUTOMOTIVE'
  when sector ~* '화학|소재|철강|금속|비금속|고무|플라스틱' then 'CHEMICAL_MATERIALS'
  when sector ~* '에너지|전력|가스|수도|석유' then 'ENERGY_UTILITIES'
  when sector ~* '금융|은행|보험|증권|신탁' then 'FINANCE'
  when sector ~* '유통|소매|식품|음료|의류|화장품|생활용품' then 'CONSUMER_RETAIL'
  when sector ~* '미디어|방송|통신|콘텐츠|엔터테인먼트' then 'MEDIA_TELECOM'
  when sector ~* '건설|부동산|건축|토목' then 'CONSTRUCTION_REAL_ESTATE'
  when sector ~* '운송|물류|항공|해운' then 'TRANSPORT_LOGISTICS'
  when sector ~* '제조|기계|장비|조선' then 'INDUSTRIAL_MANUFACTURING'
  else 'OTHER'
end
where industry_category = 'UNCLASSIFIED';

create index if not exists companies_active_industry_name_idx
  on public.companies (industry_category, name_ko, id)
  where is_active and is_listed;

comment on column public.companies.industry_category is
  'Canonical broad category mapped only from a source-provided sector; UNCLASSIFIED means the source supplied no sector.';

commit;
