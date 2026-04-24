alter table public.tutor_students
  add column if not exists grammar_topic_keys jsonb not null default '[]'::jsonb,
  add column if not exists report_language text not null default 'uk';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_students_grammar_topic_keys_is_array'
  ) then
    alter table public.tutor_students
      add constraint tutor_students_grammar_topic_keys_is_array
      check (jsonb_typeof(grammar_topic_keys) = 'array');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_students_report_language_valid'
  ) then
    alter table public.tutor_students
      add constraint tutor_students_report_language_valid
      check (report_language in ('uk', 'en'));
  end if;
end
$$;