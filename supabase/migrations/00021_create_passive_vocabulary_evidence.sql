create table public.passive_vocabulary_evidence (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  imported_by uuid references public.profiles(id) on delete set null,
  term text not null,
  normalized_term text not null,
  definition text,
  item_type text not null check (item_type in ('word', 'phrase')),
  source_type text not null check (
    source_type in ('full_text', 'manual_list', 'curated_list')
  ),
  source_label text,
  confidence integer not null default 4 check (confidence between 1 and 5),
  import_count integer not null default 1 check (import_count >= 1),
  last_imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passive_vocabulary_evidence_term_not_blank check (btrim(term) <> ''),
  constraint passive_vocabulary_evidence_normalized_term_not_blank check (
    btrim(normalized_term) <> ''
  ),
  unique (student_id, normalized_term, item_type)
);

create index idx_passive_vocabulary_evidence_student
  on public.passive_vocabulary_evidence(student_id);

create index idx_passive_vocabulary_evidence_student_type
  on public.passive_vocabulary_evidence(student_id, item_type);

alter table public.passive_vocabulary_evidence enable row level security;

create policy "Users can view own passive vocabulary evidence"
  on public.passive_vocabulary_evidence for select
  using (auth.uid() = student_id);

create policy "Users can insert own passive vocabulary evidence"
  on public.passive_vocabulary_evidence for insert
  with check (auth.uid() = student_id);

create policy "Users can update own passive vocabulary evidence"
  on public.passive_vocabulary_evidence for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy "Users can delete own passive vocabulary evidence"
  on public.passive_vocabulary_evidence for delete
  using (auth.uid() = student_id);

create policy "Superadmins can view all passive vocabulary evidence"
  on public.passive_vocabulary_evidence for select
  using (public.is_superadmin());