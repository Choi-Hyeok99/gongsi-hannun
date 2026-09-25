begin;

-- OpenDART's corporation directory retains stock codes for some former listings.
-- The company overview API classifies those corporations as E (OTHER), so they
-- must not remain visible as active exchange-listed companies.
update public.companies
set
  is_listed = false,
  is_active = false
where market = 'OTHER'
  and (is_listed or is_active);

commit;
