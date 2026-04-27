create table public.active_vocabulary_evidence (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  library_item_id uuid references public.passive_vocabulary_library(id) on delete set null,
  term text not null,
  normalized_term text not null,
  source_type text not null default 'lesson_recording'
    check (source_type in ('lesson_recording', 'manual_list', 'other')),
  source_label text,
  usage_count integer not null default 1 check (usage_count >= 1),
  first_used_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_vocabulary_evidence_term_not_blank
    check (btrim(term) <> ''),
  constraint active_vocabulary_evidence_normalized_term_not_blank
    check (btrim(normalized_term) <> '')
);

create unique index active_vocabulary_evidence_student_term_idx
  on public.active_vocabulary_evidence(student_id, normalized_term);

create index active_vocabulary_evidence_student_last_used_idx
  on public.active_vocabulary_evidence(student_id, last_used_at desc);

create index active_vocabulary_evidence_library_item_idx
  on public.active_vocabulary_evidence(library_item_id);

alter table public.active_vocabulary_evidence enable row level security;

create policy "Students can view own active vocabulary evidence"
  on public.active_vocabulary_evidence for select
  using (student_id = auth.uid());

create policy "Tutors and superadmins can view active vocabulary evidence"
  on public.active_vocabulary_evidence for select
  using (
    public.is_superadmin()
    or exists (
      select 1
      from public.tutor_students
      where tutor_students.student_id = active_vocabulary_evidence.student_id
        and tutor_students.tutor_id = auth.uid()
        and tutor_students.status = 'active'
    )
  );

create policy "Students can insert own active vocabulary evidence"
  on public.active_vocabulary_evidence for insert
  with check (student_id = auth.uid());

create policy "Tutors and superadmins can insert active vocabulary evidence"
  on public.active_vocabulary_evidence for insert
  with check (
    public.is_superadmin()
    or exists (
      select 1
      from public.tutor_students
      where tutor_students.student_id = active_vocabulary_evidence.student_id
        and tutor_students.tutor_id = auth.uid()
        and tutor_students.status = 'active'
    )
  );

create policy "Students can update own active vocabulary evidence"
  on public.active_vocabulary_evidence for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "Tutors and superadmins can update active vocabulary evidence"
  on public.active_vocabulary_evidence for update
  using (
    public.is_superadmin()
    or exists (
      select 1
      from public.tutor_students
      where tutor_students.student_id = active_vocabulary_evidence.student_id
        and tutor_students.tutor_id = auth.uid()
        and tutor_students.status = 'active'
    )
  )
  with check (
    public.is_superadmin()
    or exists (
      select 1
      from public.tutor_students
      where tutor_students.student_id = active_vocabulary_evidence.student_id
        and tutor_students.tutor_id = auth.uid()
        and tutor_students.status = 'active'
    )
  );

create policy "Students can delete own active vocabulary evidence"
  on public.active_vocabulary_evidence for delete
  using (student_id = auth.uid());

create policy "Tutors and superadmins can delete active vocabulary evidence"
  on public.active_vocabulary_evidence for delete
  using (
    public.is_superadmin()
    or exists (
      select 1
      from public.tutor_students
      where tutor_students.student_id = active_vocabulary_evidence.student_id
        and tutor_students.tutor_id = auth.uid()
        and tutor_students.status = 'active'
    )
  );
