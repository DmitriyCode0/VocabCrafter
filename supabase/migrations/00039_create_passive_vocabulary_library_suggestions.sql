create table if not exists public.passive_vocabulary_library_suggestions (
  id uuid primary key default gen_random_uuid(),
  library_item_id uuid not null references public.passive_vocabulary_library(id) on delete cascade,
  proposed_canonical_term text not null,
  proposed_normalized_term text not null,
  proposed_cefr_level text check (proposed_cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  proposed_part_of_speech text check (
    proposed_part_of_speech in (
      'noun',
      'verb',
      'modal verb',
      'auxiliary',
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
  proposed_attributes jsonb not null default '{}'::jsonb,
  suggestion_note text,
  review_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint passive_vocabulary_library_suggestions_canonical_term_not_blank check (
    btrim(proposed_canonical_term) <> ''
  ),
  constraint passive_vocabulary_library_suggestions_normalized_term_not_blank check (
    btrim(proposed_normalized_term) <> ''
  )
);

create index if not exists idx_passive_vocabulary_library_suggestions_status
  on public.passive_vocabulary_library_suggestions(status, created_at);

create index if not exists idx_passive_vocabulary_library_suggestions_library_item
  on public.passive_vocabulary_library_suggestions(library_item_id);

create index if not exists idx_passive_vocabulary_library_suggestions_created_by
  on public.passive_vocabulary_library_suggestions(created_by);

create unique index if not exists idx_passive_vocabulary_library_suggestions_pending_unique
  on public.passive_vocabulary_library_suggestions(library_item_id, created_by)
  where status = 'pending';

alter table public.passive_vocabulary_library_suggestions enable row level security;

drop policy if exists "Tutors can view own passive library suggestions"
on public.passive_vocabulary_library_suggestions;
create policy "Tutors can view own passive library suggestions"
on public.passive_vocabulary_library_suggestions
for select
using (
  created_by = auth.uid()
);

drop policy if exists "Tutors can insert passive library suggestions"
on public.passive_vocabulary_library_suggestions;
create policy "Tutors can insert passive library suggestions"
on public.passive_vocabulary_library_suggestions
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'tutor'
  )
);

drop policy if exists "Superadmins can view passive library suggestions"
on public.passive_vocabulary_library_suggestions;
create policy "Superadmins can view passive library suggestions"
on public.passive_vocabulary_library_suggestions
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can update passive library suggestions"
on public.passive_vocabulary_library_suggestions;
create policy "Superadmins can update passive library suggestions"
on public.passive_vocabulary_library_suggestions
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