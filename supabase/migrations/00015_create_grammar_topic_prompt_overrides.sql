create table if not exists public.grammar_topic_prompt_overrides (
  topic_key text primary key,
  rule_text text,
  guidance_text text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.grammar_topic_prompt_overrides enable row level security;

drop policy if exists "Superadmins can view grammar topic prompt overrides"
on public.grammar_topic_prompt_overrides;
create policy "Superadmins can view grammar topic prompt overrides"
on public.grammar_topic_prompt_overrides
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can insert grammar topic prompt overrides"
on public.grammar_topic_prompt_overrides;
create policy "Superadmins can insert grammar topic prompt overrides"
on public.grammar_topic_prompt_overrides
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can update grammar topic prompt overrides"
on public.grammar_topic_prompt_overrides;
create policy "Superadmins can update grammar topic prompt overrides"
on public.grammar_topic_prompt_overrides
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can delete grammar topic prompt overrides"
on public.grammar_topic_prompt_overrides;
create policy "Superadmins can delete grammar topic prompt overrides"
on public.grammar_topic_prompt_overrides
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);