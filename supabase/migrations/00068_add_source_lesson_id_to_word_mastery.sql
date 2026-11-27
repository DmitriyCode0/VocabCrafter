alter table public.word_mastery
  add column if not exists source_lesson_id uuid references public.tutor_student_lessons(id) on delete set null;

create index if not exists idx_word_mastery_student_source_lesson
  on public.word_mastery (student_id, source_lesson_id)
  where source_lesson_id is not null;
