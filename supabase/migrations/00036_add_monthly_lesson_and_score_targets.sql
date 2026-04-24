alter table public.tutor_students
  add column if not exists monthly_completed_lessons_target integer,
  add column if not exists monthly_average_score_target numeric(5,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_students_monthly_completed_lessons_target_nonnegative'
  ) then
    alter table public.tutor_students
      add constraint tutor_students_monthly_completed_lessons_target_nonnegative
      check (
        monthly_completed_lessons_target is null
        or monthly_completed_lessons_target >= 0
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_students_monthly_average_score_target_range'
  ) then
    alter table public.tutor_students
      add constraint tutor_students_monthly_average_score_target_range
      check (
        monthly_average_score_target is null
        or (
          monthly_average_score_target >= 0
          and monthly_average_score_target <= 100
        )
      );
  end if;
end
$$;