alter table public.tutor_student_lessons
  drop constraint if exists tutor_student_lessons_title_not_blank;

alter table public.tutor_student_lessons
  alter column title drop not null;

update public.tutor_student_lessons
set title = null
where title is not null
  and btrim(title) = '';

alter table public.tutor_student_lessons
  add constraint tutor_student_lessons_title_present_if_not_null
  check (title is null or btrim(title) <> '');