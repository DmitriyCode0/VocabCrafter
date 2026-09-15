create table public.tutor_student_lesson_library (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_key text not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tutor_id, student_id, lesson_key)
);

create index idx_tutor_student_lesson_library_student
  on public.tutor_student_lesson_library(tutor_id, student_id);

alter table public.tutor_student_lesson_library enable row level security;

create policy "Tutors can view own lesson library progress"
  on public.tutor_student_lesson_library for select
  using (auth.uid() = tutor_id);

create policy "Tutors can manage own lesson library progress"
  on public.tutor_student_lesson_library for all
  using (auth.uid() = tutor_id)
  with check (
    auth.uid() = tutor_id
    and exists (
      select 1 from public.tutor_students ts
      where ts.tutor_id = auth.uid()
        and ts.student_id = tutor_student_lesson_library.student_id
        and ts.status = 'active'
    )
  );