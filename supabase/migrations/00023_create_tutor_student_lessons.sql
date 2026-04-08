create table public.tutor_student_lessons (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  lesson_date date not null,
  start_time text,
  end_time text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_student_lessons_title_not_blank check (btrim(title) <> ''),
  constraint tutor_student_lessons_start_time_format check (
    start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  constraint tutor_student_lessons_end_time_format check (
    end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  constraint tutor_student_lessons_time_order check (
    end_time is null or start_time is null or end_time > start_time
  )
);

create index idx_tutor_student_lessons_tutor_month
  on public.tutor_student_lessons(tutor_id, lesson_date);

create index idx_tutor_student_lessons_student_month
  on public.tutor_student_lessons(student_id, lesson_date);

alter table public.tutor_student_lessons enable row level security;

create policy "Tutors can view own lessons"
  on public.tutor_student_lessons for select
  using (auth.uid() = tutor_id);

create policy "Students can view own lessons"
  on public.tutor_student_lessons for select
  using (auth.uid() = student_id);

create policy "Tutors can create own lessons"
  on public.tutor_student_lessons for insert
  with check (
    auth.uid() = tutor_id
    and exists (
      select 1 from public.tutor_students ts
      where ts.tutor_id = auth.uid()
        and ts.student_id = tutor_student_lessons.student_id
        and ts.status = 'active'
    )
  );

create policy "Tutors can update own lessons"
  on public.tutor_student_lessons for update
  using (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

create policy "Tutors can delete own lessons"
  on public.tutor_student_lessons for delete
  using (auth.uid() = tutor_id);