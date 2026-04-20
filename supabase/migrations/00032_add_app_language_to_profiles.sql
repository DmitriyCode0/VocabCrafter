alter table public.profiles
  add column if not exists app_language text not null default 'en';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_app_language_check'
  ) then
    alter table public.profiles
      add constraint profiles_app_language_check
      check (app_language in ('en', 'uk'));
  end if;
end $$;