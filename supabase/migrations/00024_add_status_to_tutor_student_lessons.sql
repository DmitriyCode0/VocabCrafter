alter table public.tutor_student_lessons
  add column status text not null default 'planned';

alter table public.tutor_student_lessons
  add constraint tutor_student_lessons_status_check
  check (status in ('planned', 'completed', 'cancelled'));