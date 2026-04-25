alter table public.tutor_students
  add column if not exists monthly_sentence_translation_target integer,
  add column if not exists monthly_gap_fill_target integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_students_monthly_sentence_translation_target_nonnegative'
  ) then
    alter table public.tutor_students
      add constraint tutor_students_monthly_sentence_translation_target_nonnegative
      check (
        monthly_sentence_translation_target is null
        or monthly_sentence_translation_target >= 0
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_students_monthly_gap_fill_target_nonnegative'
  ) then
    alter table public.tutor_students
      add constraint tutor_students_monthly_gap_fill_target_nonnegative
      check (
        monthly_gap_fill_target is null
        or monthly_gap_fill_target >= 0
      );
  end if;
end $$;