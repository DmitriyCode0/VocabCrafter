create table if not exists public.passive_vocabulary_library_ukrainian_forms (
  id uuid primary key default gen_random_uuid(),
  library_item_id uuid not null references public.passive_vocabulary_library(id) on delete cascade,
  form_term text not null,
  normalized_form text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passive_vocabulary_library_ukrainian_forms_form_term_not_blank check (
    btrim(form_term) <> ''
  ),
  constraint passive_vocabulary_library_ukrainian_forms_normalized_form_not_blank check (
    btrim(normalized_form) <> ''
  )
);

create unique index if not exists idx_passive_vocabulary_library_ukrainian_forms_unique
  on public.passive_vocabulary_library_ukrainian_forms(library_item_id, normalized_form);

create index if not exists idx_passive_vocabulary_library_ukrainian_forms_normalized
  on public.passive_vocabulary_library_ukrainian_forms(normalized_form);

alter table public.passive_vocabulary_library_ukrainian_forms enable row level security;

drop policy if exists "Superadmins can view passive vocabulary Ukrainian forms"
on public.passive_vocabulary_library_ukrainian_forms;
create policy "Superadmins can view passive vocabulary Ukrainian forms"
on public.passive_vocabulary_library_ukrainian_forms
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can insert passive vocabulary Ukrainian forms"
on public.passive_vocabulary_library_ukrainian_forms;
create policy "Superadmins can insert passive vocabulary Ukrainian forms"
on public.passive_vocabulary_library_ukrainian_forms
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

drop policy if exists "Superadmins can update passive vocabulary Ukrainian forms"
on public.passive_vocabulary_library_ukrainian_forms;
create policy "Superadmins can update passive vocabulary Ukrainian forms"
on public.passive_vocabulary_library_ukrainian_forms
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

drop policy if exists "Superadmins can delete passive vocabulary Ukrainian forms"
on public.passive_vocabulary_library_ukrainian_forms;
create policy "Superadmins can delete passive vocabulary Ukrainian forms"
on public.passive_vocabulary_library_ukrainian_forms
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
  )
);

insert into public.passive_vocabulary_library_ukrainian_forms (
  library_item_id,
  form_term,
  normalized_form,
  updated_at
)
select distinct
  library.id,
  trimmed_form,
  lower(
    regexp_replace(
      replace(replace(replace(trimmed_form, '’', ''''), 'ʼ', ''''), '`', ''''),
      '\s+',
      ' ',
      'g'
    )
  ),
  now()
from public.passive_vocabulary_library as library
cross join lateral regexp_split_to_table(
  coalesce(library.attributes ->> 'ukrainianTranslation', ''),
  E'[\n,;/]+'
) as translation_form(raw_form)
cross join lateral (
  select nullif(btrim(translation_form.raw_form), '') as trimmed_form
) as normalized_translation
where trimmed_form is not null
on conflict (library_item_id, normalized_form) do update
set form_term = excluded.form_term,
    updated_at = excluded.updated_at;

insert into public.passive_vocabulary_library_ukrainian_forms (
  library_item_id,
  form_term,
  normalized_form,
  updated_at
)
select distinct
  library.id,
  trimmed_form,
  lower(
    regexp_replace(
      replace(replace(replace(trimmed_form, '’', ''''), 'ʼ', ''''), '`', ''''),
      '\s+',
      ' ',
      'g'
    )
  ),
  now()
from public.passive_vocabulary_library as library
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(library.attributes -> 'ukrainianSearchForms') = 'array'
      then library.attributes -> 'ukrainianSearchForms'
    else '[]'::jsonb
  end
) as search_form(raw_form)
cross join lateral (
  select nullif(btrim(search_form.raw_form), '') as trimmed_form
) as normalized_search_form
where trimmed_form is not null
on conflict (library_item_id, normalized_form) do update
set form_term = excluded.form_term,
    updated_at = excluded.updated_at;