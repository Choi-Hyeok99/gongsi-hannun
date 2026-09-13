begin;

alter table public.watchlist_alert_settings
  alter column minimum_importance_score set default 70,
  alter column event_types set default array[
    'SUPPLY_CONTRACT', 'INVESTMENT', 'FUNDRAISING', 'M_AND_A', 'EARNINGS',
    'CAPITAL_CHANGE', 'SHAREHOLDER_CHANGE', 'INSIDER_OWNERSHIP_CHANGE',
    'FACILITY_EXPANSION', 'NEW_BUSINESS', 'CLINICAL_RESULT', 'POLICY_SUPPORT',
    'MANAGEMENT_CHANGE', 'MATERIAL_DISCLOSURE'
  ]::text[];

insert into public.watchlist_alert_settings (
  user_id,
  company_id,
  enabled,
  minimum_importance_score,
  event_types
)
select
  user_id,
  company_id,
  true,
  70,
  array[
    'SUPPLY_CONTRACT', 'INVESTMENT', 'FUNDRAISING', 'M_AND_A', 'EARNINGS',
    'CAPITAL_CHANGE', 'SHAREHOLDER_CHANGE', 'INSIDER_OWNERSHIP_CHANGE',
    'FACILITY_EXPANSION', 'NEW_BUSINESS', 'CLINICAL_RESULT', 'POLICY_SUPPORT',
    'MANAGEMENT_CHANGE', 'MATERIAL_DISCLOSURE'
  ]::text[]
from public.watchlist_companies
on conflict (user_id, company_id) do nothing;

commit;
