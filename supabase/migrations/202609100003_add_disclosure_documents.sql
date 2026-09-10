begin;

alter table public.source_disclosures
  add column content_fetch_status text not null default 'PENDING'
    check (content_fetch_status in ('PENDING', 'FETCHING', 'READY', 'UNAVAILABLE', 'FAILED')),
  add column content_fetch_error text check (content_fetch_error is null or char_length(content_fetch_error) <= 500);

update public.source_disclosures
set content_fetch_status = 'READY'
where content_fetched_at is not null;

create table public.disclosure_documents (
  id uuid primary key default gen_random_uuid(),
  source_disclosure_id uuid not null references public.source_disclosures(id) on delete cascade,
  sequence_no smallint not null check (sequence_no between 1 and 100),
  document_kind text not null check (document_kind in ('MAIN', 'ATTACHMENT')),
  title text not null check (char_length(title) between 1 and 500),
  file_name text not null check (
    char_length(file_name) between 1 and 300
    and file_name !~ '[\\/]|\.\.'
  ),
  mime_type text not null check (mime_type in ('application/xml', 'text/html', 'text/plain')),
  byte_size integer not null check (byte_size between 0 and 50000000),
  content_hash varchar(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  content_text text not null check (octet_length(content_text) <= 8388608),
  is_truncated boolean not null default false,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_disclosure_id, file_name),
  unique (source_disclosure_id, sequence_no)
);

create index disclosure_documents_source_idx
  on public.disclosure_documents (source_disclosure_id, sequence_no);

create trigger disclosure_documents_set_updated_at
before update on public.disclosure_documents
for each row execute function public.set_updated_at();

alter table public.disclosure_documents enable row level security;
alter table public.disclosure_documents force row level security;

revoke all on table public.disclosure_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.disclosure_documents to service_role;

comment on table public.disclosure_documents is 'Sanitized text documents extracted from the official OpenDART filing archive.';
comment on column public.disclosure_documents.content_text is 'Plain text only. Raw filing HTML is never rendered to users.';
comment on column public.source_disclosures.content_fetch_error is 'Sanitized operational message only; never store credentials or source URLs.';

commit;
