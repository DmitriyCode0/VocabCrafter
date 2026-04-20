create table if not exists public.passive_vocabulary_library (
  id uuid primary key default gen_random_uuid(),
  canonical_term text not null,
  normalized_term text not null,
  item_type text not null check (item_type in ('word', 'phrase')),
  cefr_level text check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  part_of_speech text check (
    part_of_speech in (
      'noun',
      'verb',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'conjunction',
      'determiner',
      'interjection',
      'phrase',
      'other'
    )
  ),
  attributes jsonb not null default '{}'::jsonb,
  enrichment_status text not null default 'pending' check (
    enrichment_status in ('pending', 'completed', 'failed')
  ),
  enrichment_error text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passive_vocabulary_library_canonical_term_not_blank check (
    btrim(canonical_term) <> ''
  ),
  constraint passive_vocabulary_library_normalized_term_not_blank check (
    btrim(normalized_term) <> ''
  )
);

create unique index if not exists idx_passive_vocabulary_library_normalized
  on public.passive_vocabulary_library(normalized_term, item_type);

create index if not exists idx_passive_vocabulary_library_item_type
  on public.passive_vocabulary_library(item_type);

create index if not exists idx_passive_vocabulary_library_cefr_level
  on public.passive_vocabulary_library(cefr_level);

create index if not exists idx_passive_vocabulary_library_created_by
  on public.passive_vocabulary_library(created_by);

create index if not exists idx_passive_vocabulary_library_updated_by
  on public.passive_vocabulary_library(updated_by);

create table if not exists public.passive_vocabulary_library_forms (
  id uuid primary key default gen_random_uuid(),
  library_item_id uuid not null references public.passive_vocabulary_library(id) on delete cascade,
  form_term text not null,
  normalized_form text not null,
  item_type text not null check (item_type in ('word', 'phrase')),
  is_canonical boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passive_vocabulary_library_forms_form_term_not_blank check (
    btrim(form_term) <> ''
  ),
  constraint passive_vocabulary_library_forms_normalized_form_not_blank check (
    btrim(normalized_form) <> ''
  )
);

create unique index if not exists idx_passive_vocabulary_library_forms_unique
  on public.passive_vocabulary_library_forms(normalized_form, item_type);

create index if not exists idx_passive_vocabulary_library_forms_item
  on public.passive_vocabulary_library_forms(library_item_id);

alter table public.passive_vocabulary_library enable row level security;
alter table public.passive_vocabulary_library_forms enable row level security;

drop policy if exists "Superadmins can view passive vocabulary library"
on public.passive_vocabulary_library;
create policy "Superadmins can view passive vocabulary library"
on public.passive_vocabulary_library
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can insert passive vocabulary library"
on public.passive_vocabulary_library;
create policy "Superadmins can insert passive vocabulary library"
on public.passive_vocabulary_library
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can update passive vocabulary library"
on public.passive_vocabulary_library;
create policy "Superadmins can update passive vocabulary library"
on public.passive_vocabulary_library
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can delete passive vocabulary library"
on public.passive_vocabulary_library;
create policy "Superadmins can delete passive vocabulary library"
on public.passive_vocabulary_library
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can view passive vocabulary library forms"
on public.passive_vocabulary_library_forms;
create policy "Superadmins can view passive vocabulary library forms"
on public.passive_vocabulary_library_forms
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can insert passive vocabulary library forms"
on public.passive_vocabulary_library_forms;
create policy "Superadmins can insert passive vocabulary library forms"
on public.passive_vocabulary_library_forms
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can update passive vocabulary library forms"
on public.passive_vocabulary_library_forms;
create policy "Superadmins can update passive vocabulary library forms"
on public.passive_vocabulary_library_forms
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can delete passive vocabulary library forms"
on public.passive_vocabulary_library_forms;
create policy "Superadmins can delete passive vocabulary library forms"
on public.passive_vocabulary_library_forms
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

alter table public.passive_vocabulary_evidence
  add column if not exists library_item_id uuid
  references public.passive_vocabulary_library(id)
  on delete set null;

create index if not exists idx_passive_vocabulary_evidence_library_item
  on public.passive_vocabulary_evidence(library_item_id);

insert into public.passive_vocabulary_library (
  canonical_term,
  normalized_term,
  item_type,
  enrichment_status,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select distinct on (evidence.normalized_term, evidence.item_type)
  evidence.term,
  evidence.normalized_term,
  evidence.item_type,
  case
    when evidence.item_type = 'phrase' then 'completed'
    else 'pending'
  end,
  evidence.imported_by,
  evidence.imported_by,
  evidence.created_at,
  evidence.updated_at
from public.passive_vocabulary_evidence as evidence
order by evidence.normalized_term, evidence.item_type, evidence.created_at asc
on conflict (normalized_term, item_type) do nothing;

insert into public.passive_vocabulary_library_forms (
  library_item_id,
  form_term,
  normalized_form,
  item_type,
  is_canonical,
  created_at,
  updated_at
)
select
  library.id,
  library.canonical_term,
  library.normalized_term,
  library.item_type,
  true,
  library.created_at,
  library.updated_at
from public.passive_vocabulary_library as library
on conflict (normalized_form, item_type) do nothing;

update public.passive_vocabulary_evidence as evidence
set library_item_id = library.id
from public.passive_vocabulary_library as library
where evidence.library_item_id is null
  and library.normalized_term = evidence.normalized_term
  and library.item_type = evidence.item_type;