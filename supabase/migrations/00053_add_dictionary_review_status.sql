alter table public.passive_vocabulary_library
  add column if not exists approval_status text not null default 'unconfirmed' check (
    approval_status in ('unconfirmed', 'confirmed', 'rejected')
  ),
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists idx_passive_vocabulary_library_approval_status
  on public.passive_vocabulary_library(approval_status);

update public.passive_vocabulary_library
set
  approval_status = 'unconfirmed',
  rejection_reason = null,
  reviewed_by = null,
  reviewed_at = null
where approval_status is distinct from 'unconfirmed';