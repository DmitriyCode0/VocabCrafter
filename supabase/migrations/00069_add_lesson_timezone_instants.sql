alter table public.tutor_student_lessons
  add column if not exists time_zone text,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz;

update public.tutor_student_lessons
set time_zone = coalesce(time_zone, 'Europe/Kyiv')
where time_zone is null;

update public.tutor_student_lessons
set
  start_at = case
    when start_time is not null
      then ((lesson_date::text || ' ' || start_time)::timestamp at time zone coalesce(time_zone, 'Europe/Kyiv'))
    else null
  end,
  end_at = case
    when start_time is not null and end_time is not null and end_time > start_time
      then ((lesson_date::text || ' ' || end_time)::timestamp at time zone coalesce(time_zone, 'Europe/Kyiv'))
    when start_time is not null and end_time is not null
      then (((lesson_date + 1)::text || ' ' || end_time)::timestamp at time zone coalesce(time_zone, 'Europe/Kyiv'))
    when start_time is not null
      then ((lesson_date::text || ' ' || start_time)::timestamp at time zone coalesce(time_zone, 'Europe/Kyiv')) + interval '60 minutes'
    else null
  end
where start_at is null or end_at is null;

create index if not exists idx_tutor_student_lessons_student_start_at
  on public.tutor_student_lessons (student_id, start_at)
  where student_id is not null and start_at is not null;

create index if not exists idx_tutor_student_lessons_tutor_start_at
  on public.tutor_student_lessons (tutor_id, start_at)
  where start_at is not null;
