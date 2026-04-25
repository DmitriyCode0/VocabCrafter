alter table public.tutor_student_lessons
  alter column student_id drop not null;

drop policy if exists "Tutors can create own lessons"
  on public.tutor_student_lessons;

create policy "Tutors can create own lessons"
  on public.tutor_student_lessons for insert
  with check (
    auth.uid() = tutor_id
    and (
      student_id is null
      or exists (
        select 1 from public.tutor_students ts
        where ts.tutor_id = auth.uid()
          and ts.student_id = tutor_student_lessons.student_id
          and ts.status = 'active'
      )
    )
  );

drop policy if exists "Tutors can update own lessons"
  on public.tutor_student_lessons;

create policy "Tutors can update own lessons"
  on public.tutor_student_lessons for update
  using (auth.uid() = tutor_id)
  with check (
    auth.uid() = tutor_id
    and (
      student_id is null
      or exists (
        select 1 from public.tutor_students ts
        where ts.tutor_id = auth.uid()
          and ts.student_id = tutor_student_lessons.student_id
          and ts.status = 'active'
      )
    )
  );