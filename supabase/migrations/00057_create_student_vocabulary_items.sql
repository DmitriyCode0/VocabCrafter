create table public.student_vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  library_item_id uuid references public.passive_vocabulary_library(id) on delete set null,
  term text not null,
  normalized_term text not null,
  item_type text not null check (item_type in ('word', 'phrase')),
  current_state text not null check (
    current_state in ('passive_only', 'active_and_passive', 'learning')
  ),
  has_active_evidence boolean not null default false,
  has_passive_evidence boolean not null default false,
  moved_to_learning_at timestamptz,
  learning_archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_vocabulary_items_term_not_blank
    check (btrim(term) <> ''),
  constraint student_vocabulary_items_normalized_term_not_blank
    check (btrim(normalized_term) <> '')
);

create unique index student_vocabulary_items_student_term_idx
  on public.student_vocabulary_items(student_id, normalized_term, item_type);

create index student_vocabulary_items_student_state_idx
  on public.student_vocabulary_items(student_id, current_state);

create index student_vocabulary_items_student_library_idx
  on public.student_vocabulary_items(student_id, library_item_id);

alter table public.student_vocabulary_items enable row level security;

create policy "Students can view own student vocabulary items"
  on public.student_vocabulary_items for select
  using (student_id = auth.uid());

create policy "Tutors and superadmins can view student vocabulary items"
  on public.student_vocabulary_items for select
  using (
    public.is_superadmin()
    or exists (
      select 1
      from public.tutor_students
      where tutor_students.student_id = student_vocabulary_items.student_id
        and tutor_students.tutor_id = auth.uid()
        and tutor_students.status = 'active'
    )
  );