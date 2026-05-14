alter table public.profiles
add column if not exists english_variant_preference text not null default 'american';

update public.profiles
set english_variant_preference = 'american'
where english_variant_preference is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_english_variant_preference_check'
  ) then
    alter table public.profiles
      add constraint profiles_english_variant_preference_check
      check (english_variant_preference in ('american', 'british'));
  end if;
end $$;