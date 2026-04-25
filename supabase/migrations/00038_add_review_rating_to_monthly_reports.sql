alter table public.tutor_student_monthly_reports
  add column if not exists review_rating integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_student_monthly_reports_review_rating_range'
  ) then
    alter table public.tutor_student_monthly_reports
      add constraint tutor_student_monthly_reports_review_rating_range
      check (review_rating is null or review_rating between 1 and 5);
  end if;
end $$;